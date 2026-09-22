const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#file-input');
const dropzone = document.querySelector('#dropzone');
const fileTitle = document.querySelector('#file-title');
const fileMeta = document.querySelector('#file-meta');
const submitButton = document.querySelector('#submit-button');
const emptyState = document.querySelector('#empty-state');
const processingState = document.querySelector('#processing-state');
const resultsContent = document.querySelector('#results-content');
const resultsBody = document.querySelector('#results-body');
const reviewBanner = document.querySelector('#review-banner');
const reviewText = document.querySelector('#review-text');
const jsonDialog = document.querySelector('#json-dialog');
const jsonOutput = document.querySelector('#json-output');
const toast = document.querySelector('#toast');
let latestBundle = null;
let processingTimer = null;
const processingPhases = [
  { step: 'upload', title: 'Uploading securely', description: 'Sending your report for processing.', progress: 18, delay: 0 },
  { step: 'read', title: 'Reading the report', description: 'Scanning pages and recognizing report content.', progress: 46, delay: 900 },
  { step: 'structure', title: 'Structuring observations', description: 'Turning detected values into a FHIR-ready bundle.', progress: 72, delay: 3600 },
  { step: 'review', title: 'Running quality checks', description: 'Checking units, ranges, and values that may need review.', progress: 88, delay: 7200 },
];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 4200);
}

function selectFile(file) {
  if (!file) return;
  fileInput.files = (() => { const data = new DataTransfer(); data.items.add(file); return data.files; })();
  fileTitle.textContent = file.name;
  fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to process`;
  dropzone.classList.add('is-selected');
}

fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('is-dragging'); }));
dropzone.addEventListener('drop', (event) => selectFile(event.dataTransfer.files[0]));

function formatValue(resource) {
  if (resource.valueQuantity) return `${resource.valueQuantity.value} ${resource.valueQuantity.unit}`;
  return resource.dataAbsentReason?.text || 'Not available';
}
function formatReference(resource) {
  const range = resource.referenceRange?.[0];
  if (!range) return '—';
  const low = range.low?.value ?? '—';
  const high = range.high?.value ?? '—';
  return `${low} – ${high} ${range.low?.unit || range.high?.unit || ''}`.trim();
}
function formatStatus(resource) {
  const code = resource.interpretation?.[0]?.coding?.[0]?.code;
  return { code: code || 'Review', className: code === 'N' ? 'result-normal' : (code ? 'result-high' : 'result-low') };
}
function renderResults(bundle) {
  latestBundle = bundle;
  const entries = bundle.entry || [];
  const needsReview = bundle.meta?.needsReview || [];
  document.querySelector('#observation-count').textContent = entries.length;
  document.querySelector('#review-count').textContent = needsReview.length;
  reviewBanner.hidden = needsReview.length === 0;
  reviewText.textContent = needsReview.length ? needsReview.join(', ') : '';
  resultsBody.innerHTML = entries.map(({ resource }) => {
    const status = formatStatus(resource);
    return `<tr><td>${escapeHtml(resource.code?.text || 'Unnamed test')}</td><td>${escapeHtml(formatValue(resource))}</td><td>${escapeHtml(formatReference(resource))}</td><td class="${status.className}">${status.code === 'N' ? 'Normal' : status.code === 'L' ? 'Low' : status.code === 'H' ? 'High' : 'Review'}</td></tr>`;
  }).join('');
  emptyState.hidden = true;
  resultsContent.hidden = false;
}
function setProcessingPhase(phase) {
  document.querySelector('#processing-title').textContent = phase.title;
  document.querySelector('#processing-description').textContent = phase.description;
  document.querySelector('#progress-bar').style.width = `${phase.progress}%`;
  document.querySelectorAll('.processing-step').forEach((element) => {
    const phaseIndex = processingPhases.findIndex((item) => item.step === element.dataset.step);
    const currentIndex = processingPhases.findIndex((item) => item.step === phase.step);
    element.classList.toggle('is-active', phaseIndex === currentIndex);
    element.classList.toggle('is-complete', phaseIndex < currentIndex);
  });
}
function startProcessing() {
  emptyState.hidden = true;
  resultsContent.hidden = true;
  processingState.hidden = false;
  processingPhases.forEach((phase) => window.setTimeout(() => {
    if (!processingState.hidden) setProcessingPhase(phase);
  }, phase.delay));
}
function stopProcessing() {
  processingState.hidden = true;
  if (processingTimer) window.clearTimeout(processingTimer);
  processingTimer = null;
}
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) return showToast('Choose a report before extracting.');
  submitButton.disabled = true;
  submitButton.querySelector('span').textContent = 'Reading report...';
  startProcessing();
  try {
    const data = new FormData(); data.append('file', file);
    const response = await fetch('/web/extract', { method: 'POST', body: data });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Extraction failed.');
    stopProcessing();
    renderResults(payload);
  } catch (error) {
    stopProcessing();
    emptyState.hidden = false;
    showToast(error.message || 'Could not process this report.');
  } finally { submitButton.disabled = false; submitButton.querySelector('span').textContent = 'Extract observations'; }
});

document.querySelector('#json-button').addEventListener('click', () => { jsonOutput.textContent = JSON.stringify(latestBundle, null, 2); jsonDialog.showModal(); });
document.querySelector('#close-dialog').addEventListener('click', () => jsonDialog.close());
