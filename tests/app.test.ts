jest.mock('../src/services/ocr/marker', () => ({
  extractMarkdown: jest.fn(),
}));

import request from 'supertest';
import { createApp } from '../src/app';
import { extractMarkdown } from '../src/services/ocr/marker';

const mockedExtractMarkdown = extractMarkdown as jest.MockedFunction<typeof extractMarkdown>;
const app = createApp();

const authHeader = (): string => `Bearer ${process.env.AUTH_TOKEN}`;

describe('HTTP API', () => {
  beforeEach(() => {
    mockedExtractMarkdown.mockReset();
  });

  it('serves the browser workspace at the root route', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/html');
    expect(response.text).toContain('LabLens');
  });

  it('serves public health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('rejects protected extraction requests without a bearer token', async () => {
    const response = await request(app).post('/extract');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/Authorization header/);
  });

  it('rejects extraction requests without a file', async () => {
    const response = await request(app)
      .post('/extract')
      .set('Authorization', authHeader());

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/No file uploaded/);
  });

  it('rejects unsupported file types', async () => {
    const response = await request(app)
      .post('/extract')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('not an image'), {
        filename: 'report.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Unsupported file type/);
  });

  it('returns a FHIR bundle for a valid uploaded report', async () => {
    mockedExtractMarkdown.mockResolvedValue([
      '| Test | Result | Unit | Reference Range |',
      '| --- | --- | --- | --- |',
      '| Hemoglobin | 11.2 | g/dL | 12 - 16 |',
    ].join('\n'));

    const response = await request(app)
      .post('/extract')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('synthetic report'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(200);
    expect(response.body.resourceType).toBe('Bundle');
    expect(response.body.type).toBe('collection');
    expect(response.body.entry[0].resource.code.text).toBe('Hemoglobin');
    expect(response.body.entry[0].resource.valueQuantity.value).toBe(11.2);
    expect(response.body.meta.needsReview).toEqual([]);
  });
});
