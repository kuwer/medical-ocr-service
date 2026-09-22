import axios from 'axios';
import FormData from 'form-data';
import { env } from '../../config/env';
import { AppError } from '../../middleware/AppError';
import { MarkerPollResult } from '../../types/ocr';

const MARKER_SUBMIT_URL = 'https://www.datalab.to/api/v1/marker';
const POLL_INTERVAL_MS = 2000;

interface MarkerSubmitResponse {
  success: boolean;
  request_id: string;
  request_check_url: string;
}

/**
 * Submits a file to Datalab Marker and polls until it completes, fails,
 * or the configured timeout elapses. Returns the OCR'd markdown text.
 *
 * Marker is async by design (submit -> request_check_url -> poll), so
 * this function owns that whole lifecycle and gives callers a single
 * awaitable result.
 */
export async function extractMarkdown(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const requestCheckUrl = await submit(fileBuffer, filename, mimeType);
  const markdown = await poll(requestCheckUrl);
  return markdown;
}

async function submit(fileBuffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append('file', fileBuffer, { filename, contentType: mimeType });
  form.append('output_format', 'markdown');
  form.append('mode', env.markerMode);

  let response;
  try {
    response = await axios.post<MarkerSubmitResponse>(MARKER_SUBMIT_URL, form, {
      headers: {
        ...form.getHeaders(),
        'X-API-Key': env.datalabApiKey,
      },
      timeout: 30_000,
    });
  } catch (err) {
    throw new AppError(500, `Failed to submit document to OCR provider: ${extractAxiosMessage(err)}`);
  }

  if (!response.data?.request_check_url) {
    throw new AppError(500, 'OCR provider did not return a valid request_check_url');
  }

  return response.data.request_check_url;
}

async function poll(requestCheckUrl: string): Promise<string> {
  const deadline = Date.now() + env.markerPollTimeoutSeconds * 1000;

  while (Date.now() < deadline) {
    let response;
    try {
      response = await axios.get<MarkerPollResult>(requestCheckUrl, {
        headers: { 'X-API-Key': env.datalabApiKey },
        timeout: 15_000,
      });
    } catch (err) {
      throw new AppError(500, `Failed to poll OCR provider: ${extractAxiosMessage(err)}`);
    }

    const result = response.data;

    if (result.status === 'complete') {
      if (!result.success) {
        throw new AppError(500, 'OCR provider marked the job complete but returned no content');
      }
      if (result.markdown) return result.markdown;
      if (result.result_url) return await fetchResult(result.result_url);
      throw new AppError(500, 'OCR provider marked the job complete but returned no content');
    }

    if (result.status === 'failed') {
      throw new AppError(500, `OCR provider failed to process the document: ${result.error || 'unknown error'}`);
    }

    // status === 'processing' — wait and try again
    await sleep(POLL_INTERVAL_MS);
  }

  throw new AppError(500, `OCR provider did not complete within ${env.markerPollTimeoutSeconds}s`);
}

async function fetchResult(resultUrl: string): Promise<string> {
  try {
    const response = await axios.get<string | { markdown?: string }>(resultUrl, {
      headers: { 'X-API-Key': env.datalabApiKey },
      timeout: 15_000,
    });
    if (typeof response.data === 'string') return response.data;
    if (response.data?.markdown) return response.data.markdown;
  } catch (err) {
    throw new AppError(500, `Failed to fetch OCR result: ${extractAxiosMessage(err)}`);
  }
  throw new AppError(500, 'OCR provider result URL returned no markdown content');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAxiosMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.response?.statusText || err.message;
  }
  return err instanceof Error ? err.message : 'unknown error';
}
