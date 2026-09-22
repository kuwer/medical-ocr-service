import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    // Fail fast and loud at startup rather than surfacing a confusing
    // error deep inside a request handler later.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  authToken: required('AUTH_TOKEN'),
  datalabApiKey: required('DATALAB_API_KEY'),
  markerMode: process.env.MARKER_MODE || 'balanced',
  markerPollTimeoutSeconds: parseInt(
    process.env.MARKER_POLL_TIMEOUT_SECONDS || '120',
    10
  ),
  publicWebApp: process.env.PUBLIC_WEB_APP !== 'false',
};
