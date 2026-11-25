import './style.css';
import { validateImage } from './validation.js';
import { inspectProvenance } from './provenance.js';
import { makeForensicVisuals } from './forensic-visuals.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar"><a class="brand" href="#" aria-label="Traceframe home"><span class="brand-mark" aria-hidden="true">TF</span><span>Traceframe</span></a><span class="privacy-pill"><span aria-hidden="true"></span>Visual scan by Groq</span></header>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <p class="overline">Evidence for image origin</p>
      <h1 id="page-title">A clearer picture<br class="desktop-break"> of image origin.</h1>
      <p class="lede">Check image credentials, then ask a vision model to inspect the image itself. Its visual assessment is a clue, not proof.</p>
    </section>
    <section class="workspace" aria-label="Image checker">
      <div class="upload-pane" id="drop-zone">
        <input id="file-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>
        <div class="empty-state" id="empty-state">
          <div class="frame-icon" aria-hidden="true"><svg viewBox="0 0 40 40" fill="none"><path d="M8 14V8h6M26 8h6v6M32 26v6h-6M14 32H8v-6" stroke="currentColor" stroke-width="1.5"/><path d="m12 25 5-5 4 4 3-3 5 4" stroke="currentColor" stroke-width="1.5"/><circle cx="25.5" cy="15.5" r="2.5" stroke="currentColor" stroke-width="1.5"/></svg></div>
          <h2>Bring an image into focus</h2>
          <p>Choose a JPEG, PNG or WebP image<br>up to 15 MB and 25 megapixels.</p>
          <button class="button button-primary" id="choose-button" type="button">Choose an image</button>
          <p class="drop-hint">or drop an image here</p>
        </div>
        <div class="preview-state" id="preview-state" hidden>
          <div class="preview-frame"><img id="preview-image" alt="Local preview of the selected image"><div class="scan-overlay" aria-hidden="true"><span class="scan-grid"></span><span class="scan-sweep"></span><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="scan-label" aria-hidden="true">Reading image record</span></div>
          <div class="file-meta"><div><strong id="file-name"></strong><span id="file-details"></span></div><button id="remove-button" class="icon-button" type="button" aria-label="Remove selected image">×</button></div>
        </div>
        <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>
      </div>
      <aside class="result-pane" aria-live="polite" aria-atomic="true">
        <div class="result-top"><span class="result-kicker">Your result</span><span class="result-mark" id="result-mark" aria-hidden="true">—</span></div>
        <div id="result-content" class="result-content"><h2>Waiting for an image</h2><p>Choose an image to begin. It stays in this browser while the check runs.</p></div>
        <button class="button button-dark" id="analyze-button" type="button" disabled>Check this image</button>
        <button class="text-button" id="another-button" type="button" hidden>Check another image</button>
        <div class="result-foot"><span class="tiny-lock" aria-hidden="true">◈</span><span>With your scan, a resized image is sent to Groq.</span></div>
      </aside>
    </section>
    <section class="evidence" id="evidence" aria-labelledby="evidence-title" hidden>
      <div class="evidence-heading"><div><h2 id="evidence-title">Evidence checks</h2><p>Each check answers a different question. None can prove an image is truthful.</p></div><span class="local-tag">Runs in this browser</span></div>
      <div class="evidence-grid">
        <article class="evidence-card" id="provenance-card"><span class="evidence-icon">P</span><div><h3>Content credentials</h3><p class="evidence-status">Waiting to inspect</p><p class="evidence-detail">Recorded origin and edit history, when present.</p></div></article>
        <article class="evidence-card" id="groq-card"><span class="evidence-icon">G</span><div><h3>Groq visual review</h3><p class="evidence-status">Waiting to scan</p><p class="evidence-detail">Looks for visible cues in the image pixels.</p></div></article>
        <article class="evidence-card" id="metadata-card"><span class="evidence-icon">M</span><div><h3>File information</h3><p class="evidence-status">Waiting to inspect</p><p class="evidence-detail">Basic format and dimensions; metadata can be edited or removed.</p></div></article>
      </div>
      <p class="evidence-note">The selected image is resized and sent to Groq for visual analysis. Groq says inference data is not retained by default, but temporary reliability or abuse logs may retain it for up to 30 days. A missing credential or a model opinion does not prove an image is real.</p>
      <div class="visual-lab" id="visual-lab" hidden>
        <div class="visual-lab-heading"><h3>Image signal maps</h3><p>Exploratory views of compression, fine detail, frequency, and color. These are not AI scores and do not affect the result.</p></div>
        <div class="visual-grid" id="visual-grid"></div>
      </div>
    </section>
    <section class="how" aria-label="How this check works">
      <div><span class="how-icon" aria-hidden="true">01</span><h2>Check the record</h2><p>Some images carry content credentials that record how they were made or edited.</p></div>
      <div><span class="how-icon" aria-hidden="true">02</span><h2>Visual review</h2><p>A resized copy is sent to Groq’s vision model. Your API key stays on the server.</p></div>
      <div><span class="how-icon" aria-hidden="true">03</span><h2>Missing means unknown</h2><p>Records can be removed or absent. This checker will not call an unverified image real.</p></div>
    </section>
    <p class="disclaimer">Content credentials can provide useful origin information, but this check is not forensic proof. Review the signer and recorded history before relying on a claim.</p>
  </main>
  <footer><span>Traceframe</span><span>Image origin checker</span></footer>
`;

const input = document.querySelector('#file-input');
const drop = document.querySelector('#drop-zone');
const previewState = document.querySelector('#preview-state');
const emptyState = document.querySelector('#empty-state');
const preview = document.querySelector('#preview-image');
const notice = document.querySelector('#notice');
const analyze = document.querySelector('#analyze-button');
const result = document.querySelector('#result-content');
let selectedFile = null;
let objectUrl = null;
let requestId = 0;

document.querySelector('#choose-button').addEventListener('click', () => input.click());
input.addEventListener('change', () => { if (input.files?.[0]) selectFile(input.files[0]); input.value = ''; });
document.querySelector('#remove-button').addEventListener('click', clearImage);
document.querySelector('#another-button').addEventListener('click', () => input.click());
analyze.addEventListener('click', runAnalysis);
for (const event of ['dragenter', 'dragover']) drop.addEventListener(event, (e) => { e.preventDefault(); drop.classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) drop.addEventListener(event, (e) => { e.preventDefault(); drop.classList.remove('dragging'); });
drop.addEventListener('drop', (e) => { const file = e.dataTransfer?.files?.[0]; if (file) selectFile(file); });

async function selectFile(file) {
  clearImage(false);
  document.querySelector('#evidence').hidden = true;
  notice.hidden = true;
  try {
    const details = await validateImage(file);
    selectedFile = file;
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    document.querySelector('#file-name').textContent = file.name;
    document.querySelector('#file-details').textContent = `${details.width} × ${details.height} px  ·  ${formatSize(file.size)}`;
    emptyState.hidden = true;
    previewState.hidden = false;
    analyze.disabled = false;
    document.querySelector('#another-button').hidden = true;
    document.querySelector('#result-mark').textContent = '—';
    result.innerHTML = '<h2>Ready when you are</h2><p>Check this file for content credentials and basic image details. The image stays on your device.</p>';
  } catch (error) {
    showNotice(error.message);
  }
}

function clearImage(resetPane = true) {
  requestId++;
  drop.classList.remove('is-scanning');
  selectedFile = null;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
  preview.removeAttribute('src');
  previewState.hidden = true;
  emptyState.hidden = false;
  analyze.disabled = true;
  if (resetPane) {
    notice.hidden = true;
    document.querySelector('#another-button').hidden = true;
    document.querySelector('#result-mark').textContent = '—';
    result.innerHTML = '<h2>Waiting for an image</h2><p>Choose an image to begin. It stays in this browser while the check runs.</p>';
  }
}

async function runAnalysis() {
  if (!selectedFile) return;
  const file = selectedFile;
  const myRequest = ++requestId;
  document.querySelector('#evidence').hidden = false;
  setEvidence('provenance-card', 'Checking credentials…', 'Reading recorded provenance from the selected file.');
  setEvidence('groq-card', 'Preparing visual scan…', 'A resized copy will be sent to Groq for its vision model to inspect.');
  setEvidence('metadata-card', 'Image details available', 'Dimensions and file format are shown with the preview.');

  const provenancePromise = inspectProvenance(file).catch(() => ({ status: 'unavailable' }));
  const visualPromise = scanWithGroq(file);
  const visualLab = document.querySelector('#visual-lab');
  visualLab.hidden = false;
  document.querySelector('#visual-grid').innerHTML = '<p class="visual-loading">Preparing four local image maps…</p>';
  makeForensicVisuals(file).then((maps) => {
    if (myRequest !== requestId || selectedFile !== file) return;
    const views = [
      ['ela', 'Compression difference', 'Highlights pixel changes after a JPEG re-save; compression history affects this view.'],
      ['noise', 'High-pass detail', 'Shows fine local edges and texture after neighboring pixels are removed.'],
      ['fft', 'Frequency spectrum', 'A centered view of broad and fine spatial frequencies in the image.'],
      ['color', 'Color variation', 'Visualizes local color saturation; subject matter strongly affects it.'],
    ];
    document.querySelector('#visual-grid').innerHTML = views.map(([key, title, detail]) => `<article class="visual-card"><img src="${maps[key]}" alt="${title} map for the selected image"><div><h4>${title}</h4><p>${detail}</p></div></article>`).join('');
  }).catch((error) => {
    if (myRequest !== requestId) return;
    console.warn('Exploratory image maps could not be prepared.', error);
    document.querySelector('#visual-grid').innerHTML = '<p class="visual-loading">Image maps are unavailable in this browser.</p>';
  });

  analyze.disabled = true;
  notice.hidden = true;
  drop.classList.add('is-scanning');
  document.querySelector('#result-mark').textContent = '…';
  result.innerHTML = '<h2>Reading the image</h2><p>Checking its content record and asking Groq’s vision model to inspect the pixels.</p><div class="progress-track"><span class="indeterminate"></span></div>';
  try {
    const [provenance, visual] = await Promise.all([provenancePromise, visualPromise, new Promise((resolve) => setTimeout(resolve, 1100))]);
    if (myRequest !== requestId || selectedFile !== file) return;
    const isAiRecorded = provenance.status === 'found' && provenance.generated;
    const visualTitle = visual.assessment === 'ai_like' ? 'Possible AI-like visual cues' : visual.assessment === 'no_clear_ai_cues' ? 'No clear AI-like cues spotted' : visual.error ? 'Visual scan unavailable' : 'Visual scan inconclusive';
    const visualDetail = visual.error ? visual.error : `${(visual.observations ?? []).map(escapeHtml).join(' · ') || 'The model did not identify a clear visual cue.'} ${escapeHtml(visual.caveat ?? 'This is not proof of image origin.')}`;
    const originCard = isAiRecorded
      ? `<div class="origin-verdict origin-ai"><span>CONTENT CREDENTIALS</span><strong>AI origin recorded</strong><p>This image’s content credentials record AI generation${provenance.generator ? ` · Generator listed: ${escapeHtml(provenance.generator)}` : ''}.</p></div>`
      : `<div class="origin-verdict origin-unknown"><span>VISUAL REVIEW</span><strong>${visualTitle}</strong><p>${visualDetail}</p></div>`;
    const secondaryVisual = isAiRecorded ? `<div class="visual-note"><strong>${visualTitle}</strong><p>${visualDetail}</p></div>` : '';
    result.innerHTML = `${originCard}${secondaryVisual}`;
    document.querySelector('#result-mark').textContent = isAiRecorded ? 'AI' : visual.assessment === 'ai_like' ? 'AI?' : '?';
    document.querySelector('#another-button').hidden = false;

    const visualEvidenceTitle = visual.error ? 'Visual scan unavailable' : visualTitle;
    const visualEvidenceDetail = visual.error ? visual.error : `${(visual.observations ?? []).map(escapeHtml).join(' · ') || 'No specific visual cue identified.'} ${escapeHtml(visual.caveat ?? 'Not proof of origin.')}`;
    setEvidence('groq-card', visualEvidenceTitle, visualEvidenceDetail);

    if (isAiRecorded) {
      setEvidence('provenance-card', 'AI generation recorded', provenance.generator ? `The credential lists ${provenance.generator} as its generator. Review its signer and history.` : 'The file contains a content credential that records AI generation.');
    } else if (provenance.status === 'invalid') {
      setEvidence('provenance-card', 'Credential failed validation', 'A record was present, but its integrity check reported a problem.');
    } else if (provenance.status === 'absent') {
      setEvidence('provenance-card', 'No credential found', 'Credentials can be absent or removed. This says nothing by itself about whether the image is real.');
    } else if (provenance.status === 'found') {
      setEvidence('provenance-card', 'Credential found', 'This credential does not explicitly record AI generation. Check its signer and history.');
    } else {
      setEvidence('provenance-card', 'Check unavailable', 'This file could not be checked for content credentials.');
    }
  } catch (error) {
    if (myRequest !== requestId || selectedFile !== file) return;
    console.error(error);
    result.innerHTML = '<div class="origin-verdict origin-warning"><span>IMAGE CHECK</span><strong>Scan could not finish</strong><p>Check the connection and Groq API key, then try again.</p></div>';
    document.querySelector('#result-mark').textContent = '!';
    document.querySelector('#another-button').hidden = false;
    setEvidence('provenance-card', 'Check unavailable', 'The credential reader could not finish.');
    showNotice('The origin check could not finish. Try again or choose another image.');
  } finally {
    drop.classList.remove('is-scanning');
    if (myRequest === requestId && selectedFile === file) analyze.disabled = false;
  }
}

async function scanWithGroq(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const image = canvas.toDataURL('image/jpeg', 0.86);
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { assessment: 'inconclusive', error: result.error ?? 'The visual scan could not finish.' };
    return result;
  } catch (error) {
    return { assessment: 'inconclusive', error: error.message ?? 'The visual scan could not finish.' };
  }
}

function showNotice(message) { notice.textContent = message; notice.hidden = false; }
function setEvidence(id, title, detail) {
  const card = document.getElementById(id);
  if (!card) return;
  card.querySelector('.evidence-status').textContent = title;
  card.querySelector('.evidence-detail').textContent = detail;
}
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
