import './style.css';
import { validateImage } from './validation.js';
import { inspectProvenance } from './provenance.js';
import { makeForensicVisuals } from './forensic-visuals.js';
import { inspectImageMetadata } from './image-metadata.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar"><a class="brand" href="#" aria-label="Traceframe home"><span class="brand-mark" aria-hidden="true">TF</span><span>Traceframe</span></a><span class="privacy-pill"><span aria-hidden="true"></span>Private by design</span></header>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <p class="overline">Evidence for image origin</p>
      <h1 id="page-title">A clearer picture<br class="desktop-break"> of image origin.</h1>
      <p class="lede">Check for recorded image origins and file details. Missing records cannot tell you whether an image is real or AI-generated.</p>
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
          <div class="preview-frame"><img id="preview-image" alt="Local preview of the selected image"><div class="scan-overlay" aria-hidden="true"><span class="scan-grid"></span><span class="scan-sweep"></span><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="scan-label" aria-hidden="true">Reading image records</span></div>
          <div class="file-meta"><div><strong id="file-name"></strong><span id="file-details"></span></div><button id="remove-button" class="icon-button" type="button" aria-label="Remove selected image">×</button></div>
        </div>
        <div class="notice" id="notice" role="status" aria-live="polite" hidden></div>
      </div>
      <aside class="result-pane" aria-live="polite" aria-atomic="true">
        <div class="result-top"><span class="result-kicker">Your result</span><span class="result-mark" id="result-mark" aria-hidden="true">—</span></div>
        <div id="result-content" class="result-content"><h2>Waiting for an image</h2><p>Choose an image to begin. It stays in this browser while the check runs.</p></div>
        <button class="button button-dark" id="analyze-button" type="button" disabled>Check this image</button>
        <button class="text-button" id="another-button" type="button" hidden>Check another image</button>
        <div class="result-foot"><span class="tiny-lock" aria-hidden="true">◈</span><span>Your image is never uploaded by this app.</span></div>
      </aside>
    </section>
    <section class="evidence" id="evidence" aria-labelledby="evidence-title" hidden>
      <div class="evidence-heading"><div><h2 id="evidence-title">Evidence checks</h2><p>Each check answers a different question. None can prove an image is truthful.</p></div><span class="local-tag">Runs in this browser</span></div>
      <div class="evidence-grid">
        <article class="evidence-card" id="provenance-card"><span class="evidence-icon">P</span><div><h3>Content credentials</h3><p class="evidence-status">Waiting to inspect</p><p class="evidence-detail">Recorded origin and edit history, when present.</p></div></article>
        <article class="evidence-card" id="metadata-card"><span class="evidence-icon">M</span><div><h3>File information</h3><p class="evidence-status">Waiting to inspect</p><p class="evidence-detail">Basic format and dimensions; metadata can be edited or removed.</p></div></article>
        <article class="evidence-card" id="metadata-clue-card"><span class="evidence-icon">I</span><div><h3>File metadata clues</h3><p class="evidence-status">Waiting to inspect</p><p class="evidence-detail">Extra AI-tool tags or camera details saved with the file.</p></div></article>
      </div>
      <p class="evidence-note" id="evidence-note">No AI label found does not prove an image is original. Some AI-made images have no label.</p>
      <div class="visual-lab" id="visual-lab" hidden>
        <div class="visual-lab-heading"><h3>Image signal maps</h3><p>Exploratory views of compression, fine detail, frequency, and color. These are not AI scores and do not affect the result.</p></div>
        <div class="visual-grid" id="visual-grid"></div>
      </div>
    </section>
    <section class="how" aria-label="How this check works">
      <div><span class="how-icon" aria-hidden="true">01</span><h2>Check the record</h2><p>Some images carry content credentials that record how they were made or edited.</p></div>
      <div><span class="how-icon" aria-hidden="true">02</span><h2>Processed here</h2><p>Your image stays in this browser while credentials and file details are checked.</p></div>
      <div><span class="how-icon" aria-hidden="true">03</span><h2>No AI label found</h2><p>Some AI-made images have no label, so this result cannot confirm an image is original.</p></div>
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
    result.innerHTML = '<h2>Ready when you are</h2><p>Check this file for content credentials and metadata. The image stays on your device.</p>';
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
  setEvidence('metadata-card', 'Image details available', 'Dimensions and file format are shown with the preview.');
  setEvidence('metadata-clue-card', 'Reading image metadata…', 'Checking for AI-tool tags and camera details saved in the file.');

  const provenancePromise = inspectProvenance(file).catch(() => ({ status: 'unavailable' }));
  const imageMetadataPromise = inspectImageMetadata(file).catch(() => ({ status: 'unavailable', aiHints: [], cameraDetails: [], metadataCount: 0 }));
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
  result.innerHTML = '<h2>Checking image records</h2><p>Looking for content credentials and metadata. This usually takes a moment.</p><div class="progress-track"><span class="indeterminate"></span></div>';
  try {
    const [provenance, imageMetadata] = await Promise.all([provenancePromise, imageMetadataPromise, new Promise((resolve) => setTimeout(resolve, 1100))]);
    if (myRequest !== requestId || selectedFile !== file) return;
    const isAiRecorded = provenance.status === 'found' && provenance.generated;
    const hasAiMetadataHint = imageMetadata.aiHints?.length > 0;
    const hasCameraDetails = imageMetadata.cameraDetails?.length > 0;
    const evidenceNote = document.querySelector('#evidence-note');
    if (isAiRecorded) {
      evidenceNote.textContent = 'The Content Credential above records AI generation. The separate file-metadata check found no extra AI-tool or camera tags.';
    } else if (provenance.status === 'invalid') {
      evidenceNote.textContent = 'This Content Credential failed validation. Do not rely on its origin claim.';
    } else if (hasAiMetadataHint) {
      evidenceNote.textContent = 'AI-tool tags come from editable file metadata. They are clues, not verified origin records.';
    } else if (provenance.status === 'found') {
      evidenceNote.textContent = 'A Content Credential is present, but it does not record AI generation. That alone does not prove the image is original.';
    } else if (hasCameraDetails) {
      evidenceNote.textContent = 'Camera details can be edited or removed. They do not prove the image is an untouched camera original.';
    } else if (provenance.status === 'unavailable') {
      evidenceNote.textContent = 'The origin check could not read this file. No conclusion about AI generation can be made.';
    } else {
      evidenceNote.textContent = 'No AI label found does not prove an image is original. Some AI-made images have no label.';
    }
    const originCard = isAiRecorded
      ? `<div class="origin-verdict origin-ai"><span>CONTENT CREDENTIALS</span><strong>AI origin recorded</strong><p>This image’s content credentials record AI generation${provenance.generator ? ` · Generator listed: ${escapeHtml(provenance.generator)}` : ''}.</p></div>`
      : provenance.status === 'invalid'
        ? '<div class="origin-verdict origin-warning"><span>CONTENT CREDENTIALS</span><strong>Credential failed validation</strong><p>A record was found, but its integrity check reported a problem. Do not rely on its origin claim.</p></div>'
        : hasAiMetadataHint
          ? `<div class="origin-verdict origin-unknown"><span>IMAGE METADATA</span><strong>AI-tool tags found</strong><p>The file mentions ${escapeHtml(imageMetadata.aiHints.join(', '))}. These tags can be edited and do not verify who made the image.</p></div>`
          : provenance.status === 'found'
            ? '<div class="origin-verdict origin-unknown"><span>CONTENT CREDENTIALS</span><strong>Credential found</strong><p>It does not explicitly record AI generation. Check its signer and history before relying on it.</p></div>'
            : hasCameraDetails
              ? `<div class="origin-verdict origin-unknown"><span>IMAGE METADATA</span><strong>Camera details found</strong><p>${escapeHtml(imageMetadata.cameraDetails.join(' · '))}. These details can be edited and do not prove the image is an untouched camera photo.</p></div>`
              : provenance.status === 'absent'
                ? '<div class="origin-verdict origin-unknown"><span>IMAGE RECORDS</span><strong>No AI label found</strong><p>This file has no AI-generation label. It may still be AI-made; labels can be missing or removed.</p></div>'
                : '<div class="origin-verdict origin-unknown"><span>IMAGE RECORDS</span><strong>Origin check unavailable</strong><p>This app could not read the image records, so it cannot report an origin.</p></div>';
    result.innerHTML = originCard;
    document.querySelector('#result-mark').textContent = isAiRecorded ? 'AI' : hasAiMetadataHint ? 'TAG' : hasCameraDetails ? 'CAM' : '?';
    document.querySelector('#another-button').hidden = false;

    if (isAiRecorded) {
      setEvidence('provenance-card', 'AI generation recorded', provenance.generator ? `The credential lists ${provenance.generator} as its generator. Review its signer and history.` : 'The file contains a content credential that records AI generation.');
    } else if (provenance.status === 'invalid') {
      setEvidence('provenance-card', 'Credential failed validation', 'A record was present, but its integrity check reported a problem.');
    } else if (provenance.status === 'absent') {
      setEvidence('provenance-card', 'No AI label found', 'The file may still be AI-made; this check only reads labels saved with the image.');
    } else if (provenance.status === 'found') {
      setEvidence('provenance-card', 'Credential found', 'This credential does not explicitly record AI generation. Check its signer and history.');
    } else {
      setEvidence('provenance-card', 'Check unavailable', 'This file could not be checked for content credentials.');
    }
    if (imageMetadata.status === 'unavailable') {
      setEvidence('metadata-clue-card', 'Metadata check unavailable', 'This browser could not read the image metadata.');
    } else if (hasAiMetadataHint) {
      setEvidence('metadata-clue-card', 'AI-tool tags found', `File metadata mentions ${imageMetadata.aiHints.join(', ')}. Tags can be edited or removed.`);
    } else if (hasCameraDetails) {
      setEvidence('metadata-clue-card', 'Camera details found', `${imageMetadata.cameraDetails.join(' · ')}. These details can be edited or removed.`);
    } else if (imageMetadata.metadataCount) {
      setEvidence('metadata-clue-card', 'Other metadata found', 'No recognized AI-tool tag or camera details were found. This does not tell us how the image was made.');
    } else {
      setEvidence('metadata-clue-card', 'No extra AI or camera tags found', 'This file does not include extra tags for those clues. That does not tell us how the image was made.');
    }
  } catch (error) {
    if (myRequest !== requestId || selectedFile !== file) return;
    console.error(error);
    result.innerHTML = '<div class="origin-verdict origin-warning"><span>CONTENT CREDENTIALS</span><strong>Origin check unavailable</strong><p>This app could not inspect the file. Try again or choose another image.</p></div>';
    document.querySelector('#result-mark').textContent = '!';
    document.querySelector('#another-button').hidden = false;
    setEvidence('provenance-card', 'Check unavailable', 'The credential reader could not finish.');
    showNotice('The origin check could not finish. Try again or choose another image.');
  } finally {
    drop.classList.remove('is-scanning');
    if (myRequest === requestId && selectedFile === file) analyze.disabled = false;
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
