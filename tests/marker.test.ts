jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      post: jest.fn(),
      get: jest.fn(),
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

import axios from 'axios';
import { extractMarkdown } from '../src/services/ocr/marker';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Marker OCR lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches markdown from result_url when polling returns a completed job without inline markdown', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        success: true,
        request_id: 'request-1',
        request_check_url: 'https://datalab.test/check/request-1',
      },
    });
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          status: 'complete',
          success: true,
          result_url: 'https://datalab.test/results/request-1',
        },
      })
      .mockResolvedValueOnce({ data: { markdown: '| Test | Result |' } });

    await expect(
      extractMarkdown(Buffer.from('report'), 'report.pdf', 'application/pdf')
    ).resolves.toBe('| Test | Result |');

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });
});
