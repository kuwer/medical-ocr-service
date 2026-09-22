# Medical Report OCR Service - Evaluation Results

This document records an end-to-end evaluation against the assignment criteria.

## Test Input

The service was tested with this real sample report included in the workspace:

```text
uploads/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf
```

The file is a 72 KB PDF and was accepted by the upload layer.

The saved successful response is available at:

```text
sample-labtest-response.json
```

## Correctness

### End-to-end request

The service was started with:

```bash
npm run dev
```

The endpoint was called with the configured bearer token and the uploaded PDF:

```bash
set -a; source .env; set +a

curl -sS -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@uploads/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf" \
  | jq
```

### Observed result

The request completed successfully and returned:

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "observationCount": 14
}
```

The complete response is preserved in
[sample-labtest-response.json](sample-labtest-response.json) so an evaluator
can inspect every returned FHIR resource without relying on screenshots.

The response included extracted CBC results such as:

| Test | Value | Interpretation |
|---|---:|---|
| Hemoglobin (Hb) | 12.5 g/dL | Low |
| Total RBC count | 5.2 mill/cumm | Normal |
| Packed Cell Volume (PCV) | 57.5 % | High |
| Total WBC count | 9000 cumm | Normal |
| Platelet Count | 150000 cumm | Normal |

The parser excluded the report metadata row `Primary Sample Type : Blood`,
normalized OCR line-break markup in calculated test names, and returned an empty
`meta.needsReview` list for this clean sample.

### Authentication proof

Requests without a bearer header return:

```json
{
  "error": "Missing or malformed Authorization header. Expected: Bearer <token>"
}
```

A request with the token from `.env` reached the protected endpoint successfully. A missing file then returned:

```json
{
  "error": "No file uploaded. Send it as multipart/form-data under the \"file\" field."
}
```

This proves authentication runs before the protected extraction route.

## FHIR Structure

The response uses the expected top-level structure:

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "status": "preliminary",
        "code": {},
        "valueQuantity": {},
        "interpretation": [],
        "referenceRange": []
      }
    }
  ]
}
```

Each extracted numeric result contains:

- `Observation.resourceType`
- `status: "preliminary"`
- test name in `code.text`
- numeric `valueQuantity.value`
- unit in `valueQuantity.unit`
- optional LOINC coding for recognized tests
- interpretation `L`, `H`, or `N` when both reference limits are available
- reference range when present in the report

The implementation includes LOINC examples including Hemoglobin (`718-7`), RBC (`789-8`), WBC (`6690-2`), and platelets (`777-3`).

### FHIR qualification

The core `Bundle` and `Observation` shapes follow the assignment response. The custom `meta.needsReview` field is assignment-specific rather than a standard FHIR R4 `Meta` property. A strict production FHIR implementation should represent review state with a FHIR extension or return it in a separate application envelope.

## Code Quality

The code separates the pipeline into independently testable modules:

```text
src/services/ocr/marker.ts              Marker submission and polling
src/services/parsing/reportParser.ts   OCR markdown to parsed observations
src/services/fhir/mapper.ts             Parsed rows to FHIR Observation
src/services/validation/validator.ts   Numeric and unit checks
src/routes/extract.ts                   Request orchestration only
```

The route validates the upload, calls OCR, parses the result, maps observations, runs validation, and assembles the response without containing the parsing or FHIR mapping algorithms itself.

## Error Handling

The service has explicit handling for the required error classes:

| Case | Expected response |
|---|---|
| Missing or malformed bearer header | `401` JSON error |
| Invalid bearer token | `401` JSON error |
| Missing upload | `400` JSON error |
| Unsupported MIME type | `400` JSON error |
| OCR returns no parsed observations | `422` JSON error |
| OCR provider or unexpected failure | `500` JSON error |

The health and root endpoints are public:

```text
GET /health
GET /
```

The extraction endpoint is protected:

```text
POST /extract
```

## README / Setup

The documented setup flow is:

```bash
npm install
cp .env.example .env
# Set AUTH_TOKEN and DATALAB_API_KEY
npm run dev
```

The production TypeScript build currently passes:

```text
npm run build
# completed successfully
```

The automated test suite currently passes, including unit, parser, provider
lifecycle, and HTTP route tests:

```text
Test Suites: 5 passed, 5 total
Tests:       26 passed, 26 total
```

## Docker Setup

The repository includes `Dockerfile`, `docker-compose.yml`, `.dockerignore`,
and `.env.example` for a reproducible container setup.

```bash
cp .env.example .env
# Set AUTH_TOKEN and DATALAB_API_KEY in .env
docker compose up --build
```

The container exposes port `3000`. The smoke check is:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","service":"medical-report-ocr-service"}
```

The sample report can then be submitted with:

```bash
set -a; source .env; set +a
curl -sS -X POST http://localhost:3000/extract \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F "file=@uploads/CBC-test-report-format-example-sample-template-Drlogy-lab-report.pdf" \
  | jq
```

The Dockerfile uses `npm ci` for deterministic dependency installation and the
Docker build context excludes local secrets, dependencies, generated output,
and uploaded reports.

### Docker verification performed

```bash
docker compose build
# Image built successfully

docker compose up -d
curl http://localhost:3000/health
```

Observed health response from the running container:

```json
{"status":"ok","service":"medical-report-ocr-service"}
```

## Remaining Production Considerations

The assignment-level gaps have been addressed with implementation and tests:

- Short LOINC synonyms no longer use unsafe substring matching.
- Report metadata such as `Primary Sample Type` is filtered out.
- HTML line-break markup in OCR test names is normalized.
- Invalid OCR values use FHIR `dataAbsentReason` instead of fabricated zero quantities.
- Route-level tests cover authentication, upload validation, and successful FHIR output.
- Marker tests cover a completed response that returns markdown through `result_url`.
- `.env.example` and `.dockerignore` are included for setup and secret isolation.
- Jest supplies non-secret test defaults, so the test suite works without a local `.env`.

Before production healthcare use, rotate any credentials that have been exposed,
validate the response with a full FHIR R4 validator, and replace the static
shared token with a managed per-client authentication system.

## Overall Assessment

The service demonstrates a successful authenticated, real-file, end-to-end
OCR-to-FHIR flow. The saved response contains 14 cleaned CBC observations with
FHIR-compatible Observation fields, and the project has a clear modular design,
passing automated tests, a passing production build, and a verified Docker
setup. It is complete for the assignment prototype scope.

For production healthcare use, rotate any exposed credentials, validate the
response with a full FHIR R4 validator, and replace the static shared token with
a managed per-client authentication system.
