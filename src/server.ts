import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`medical-report-ocr-service listening on port ${env.port}`);
});
