# Medical Report OCR Service

A standalone Node.js/TypeScript microservice that accepts a diagnostic report (image or PDF), extracts medical observations using the [Datalab Marker](https://www.datalab.to) OCR API, and returns them as a FHIR R4 `Bundle` of `Observation` resources.

## Architecture

```
src/
  server.ts                    # entry point
  app.ts                       # Express app + middleware wiring
  config/env.ts                # env var loading, fails fast if misconfigured
  middleware/
    auth.ts                    # Bearer token check
    errorHandler.ts            # maps errors -> HTTP status codes
    AppError.ts                # typed error w/ status code
  routes/
    extract.ts                 # POST /extract
    health.ts                  # GET /health
  services/
    ocr/marker.ts               # Datalab Marker client (submit + poll)
    parsing/reportParser.ts     # OCR markdown -> structured rows
    fhir/mapper.ts               # structured row -> FHIR Observation
    fhir/loinc.ts                 # static LOINC lookup (bonus)
    validation/validator.ts       # sanity checks -> needsReview
tests/
  validator.test.ts             # required test coverage
  mapper.test.ts                 # extra coverage for FHIR mapping logic
```

Each stage (OCR → parse → map → validate) is a separate, independently testable module. The route handler in `extract.ts` only orchestrates them — it has no parsing or FHIR logic of its own. Route, parser, mapper, validator, and Marker lifecycle tests are included under `tests/`.

For reproducible evaluation evidence, including the real CBC PDF test result,
Docker smoke test, saved response, and production considerations, see
[RESULTS.md](RESULTS.md) and [sample-labtest-response.json](sample-labtest-response.json).

## Setup

**Requirements:** Node.js 18+, a [Datalab](https://www.datalab.to/auth/sign_up) account (free tier is sufficient) and API key from [datalab.to/settings](https://www.datalab.to/settings).

```bash
git clone https://github.com/kuwer/medical-ocr-service.git
cd medical-ocr-service
npm install
cp .env.example .env
# edit .env: set AUTH_TOKEN and DATALAB_API_KEY
npm run dev
```

The service listens on `http://localhost:3000` (or whatever `PORT` you set).

### Configure AUTH_TOKEN

Each user or installation should generate its own token. From the project
directory, run:

```bash
openssl rand -hex 32
```

Copy the printed value into `.env` like this:

```env
AUTH_TOKEN=paste-the-generated-value-here
DATALAB_API_KEY=your-datalab-api-key
```

Load the values into the current terminal before making requests:

```bash
set -a
source .env
set +a
```

The client must send that token with the `Bearer` prefix:

```bash
curl -H "Authorization: Bearer $AUTH_TOKEN" http://localhost:3000/health
```

Do not use the literal text `paste-the-generated-value-here`, and do not share
or commit `.env`. The token is a local shared secret for that installation.

### Running with Docker

```bash
cp .env.example .env
# Set AUTH_TOKEN and DATALAB_API_KEY in .env
docker compose up --build
```

The container listens on `http://localhost:3000`. In another terminal, verify it
is running:

```bash
curl http://localhost:3000/health
```

To process the sample report in this repository:

```bash
set -a; source .env; set +a
curl -sS -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@uploads/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf" \
  | jq
```

Stop the container with `Ctrl+C`, or run `docker compose down` from another
terminal. Do not commit `.env`; it contains secrets and is excluded from the
Docker build context.

### Running tests

```bash
npm test
# 26 tests passing
```

### Evaluation Evidence

The repository includes the actual successful response in
[sample-labtest-response.json](sample-labtest-response.json). It was generated
from the sample CBC PDF with:

```bash
set -a; source .env; set +a
curl -sS -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@uploads/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf" \
  | tee sample-labtest-response.json | jq
```

The response contains a FHIR `Bundle` with 14 `Observation` resources and an
empty `meta.needsReview` list. The saved JSON and reproducible command provide
the evaluation evidence without exposing bearer tokens or Datalab API keys.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port |
| `AUTH_TOKEN` | Yes | — | Static bearer token clients must send |
| `DATALAB_API_KEY` | Yes | — | API key from datalab.to |
| `MARKER_MODE` | No | `balanced` | Datalab Marker processing mode: `fast`, `balanced`, or `accurate` |
| `MARKER_POLL_TIMEOUT_SECONDS` | No | `120` | Max seconds to poll Marker before returning a 500 |

## Example Request

```bash
curl -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@/path/to/lab-report.jpg"
```

Response is a FHIR `Bundle`, per the assignment spec — see the top-level example in the assignment doc for the exact shape.

## Error Responses

| Status | Meaning |
|---|---|
| `400` | No file uploaded, or an unsupported file type |
| `401` | Missing or invalid bearer token |
| `422` | OCR succeeded but no observations could be extracted |
| `500` | Upstream OCR failure or unexpected server error (message only, never a stack trace) |

## Assumptions & Trade-offs

- **Report parsing is heuristic, not a general table-understanding engine.** `reportParser.ts` handles two common shapes: a markdown table (with header-based column detection) and space-separated plain-text lines, both tuned for standard CBC/LFT-style reports (Thyrocare, SRL, and similar). Unusual layouts — multi-line cells, merged headers, non-English test names — may be missed. A row the parser can't confidently read is skipped rather than guessed at.
- **Validation is intentionally narrow**, matching exactly what the spec asks for: numeric-value cleanliness and unit presence. A value like `"11.2*"` is still parsed (best-effort, as `11.2`) but flagged in `meta.needsReview` because the raw OCR token wasn't clean.
- **Interpretation (`L`/`H`/`N`) is only computed when both a value and a full reference range are available**; otherwise the `interpretation` field is omitted rather than guessed.
- **LOINC lookup is a small static table** of ~17 common tests (CBC, LFT, KFT, lipid panel, thyroid). It's a bonus, not a requirement — unmatched test names still return a valid `Observation` with `code.text` only, no `coding`.
- **No file persistence.** Uploaded files are held in memory only for the duration of the request (`multer.memoryStorage()`) and never written to disk — appropriate for a healthcare-adjacent service handling PHI.
- **Auth is a single static bearer token**, matching the assignment's scope. A production system would want per-client tokens, rotation, and probably OAuth2/mTLS given this touches health data.
- **Multi-page PDFs**: Marker itself processes all pages of a PDF and returns combined markdown, so multi-page reports are handled by virtue of the parser running over the full OCR'd text — this wasn't separately special-cased.

## Bonus Features Implemented

- ✅ LOINC code lookup for common tests
- ✅ Docker + `docker-compose.yml`
- ✅ `GET /health` endpoint
- ✅ Multi-page PDF handling (via Marker's own multi-page support)
