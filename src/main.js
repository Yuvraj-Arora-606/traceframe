import './style.css';
import { MODEL_CONFIG } from './model-config.js';
import { validateImage, classifySignal } from './validation.js';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar"><a class="brand" href="#" aria-label="Still / Signal home"><span class="brand-mark" aria-hidden="true">s<span>/</span>s</span><span>Still / Signal</span></a><span class="privacy-pill"><span aria-hidden="true"></span>Private by design</span></header>
  <main>
    <section class="intro" aria-labelledby="page-title">
      <p class="overline">A first look, not a final answer</p>
      <h1 id="page-title">Where did this image<br class="desktop-break"> come from?</h1>
      <p class="lede">A local image check can offer a clue. It cannot tell you who made an image or prove what happened.</p>
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
          <img id="preview-image" alt="Local preview of the selected image">
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
    <section class="how" aria-label="How this check works">
      <div><span class="how-icon" aria-hidden="true">01</span><h2>A model signal</h2><p>The classifier compares visual patterns with ones it learned during training.</p></div>
      <div><span class="how-icon" aria-hidden="true">02</span><h2>Processed here</h2><p>The model downloads from Hugging Face on first use. Your image stays on your device.</p></div>
      <div><span class="how-icon" aria-hidden="true">03</span><h2>Room for doubt</h2><p>Compression, edits, or unfamiliar image sources can change the result. Detectors can be wrong.</p></div>
    </section>
    <p class="disclaimer">This is an experimental classifier, not forensic evidence. Don't rely on it alone to make decisions about an image.</p>
  </main>
  <footer><span>Still / Signal</span><span>Experimental browser prototype</span></footer>
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
let classifierPromise = null;
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
    result.innerHTML = '<h2>Ready when you are</h2><p>The image is selected locally. Start a check to load the model and inspect it in your browser.</p>';
  } catch (error) {
    showNotice(error.message);
  }
}

function clearImage(resetPane = true) {
  requestId++;
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
  analyze.disabled = true;
  notice.hidden = true;
  document.querySelector('#result-mark').textContent = '…';
  result.innerHTML = '<h2>Preparing the model</h2><p>The first download can take a little while. The image itself remains on this device.</p><div class="progress-track"><span></span></div><p class="model-status" id="model-status">Connecting to the model host…</p>';
  try {
    const { model, processor, backend } = await loadClassifier((event) => {
      if (myRequest !== requestId) return;
      const label = event.status === 'progress' ? `Downloading model files · ${formatSize(event.loaded ?? 0)} received` : event.status === 'done' ? 'Model file ready' : event.file ?? 'Preparing model files…';
      const status = document.querySelector('#model-status');
      if (status) status.textContent = label;
      if (event.status === 'progress' && event.total) {
        const bar = document.querySelector('.progress-track span');
        if (bar) bar.style.width = `${Math.min(100, (event.loaded / event.total) * 100)}%`;
      }
    });
    if (myRequest !== requestId || selectedFile !== file) return;
    document.querySelector('#result-mark').textContent = '…';
    result.innerHTML = '<h2>Reading the image</h2><p>Comparing the image with patterns learned by the classifier.</p><div class="progress-track"><span class="indeterminate"></span></div>';
    const started = performance.now();
    const { RawImage } = await import('@huggingface/transformers');
    const image = await RawImage.fromBlob(file);
    const { pixel_values } = await processor(image);
    const output = await model({ pixel_values });
    const rawLogit = Number(output.logits?.data?.[0]);
    const signal = classifySignal(rawLogit);
    if (myRequest !== requestId || selectedFile !== file) return;
    console.info('Image authenticity model output', output, 'logit', rawLogit, 'inference_ms', Math.round(performance.now() - started));
    const copy = {
      'ai-like': ['AI-like signal', 'The detector found patterns its model associates with generated images. This is a model signal, not proof of how the image was made.'],
      'camera-like': ['Camera-like signal', 'The detector found fewer patterns it associates with generated images. This does not confirm the image came from a camera.'],
      inconclusive: ['Inconclusive', 'The model did not return a usable signal for this image. Try another image or investigate its source another way.'],
    }[signal];
    result.innerHTML = `<h2>${copy[0]}</h2><p>${copy[1]}</p><p class="signal-detail">Experimental threshold · ${backend} · results are not validated or calibrated.</p>`;
    document.querySelector('#result-mark').textContent = signal === 'ai-like' ? 'A' : signal === 'camera-like' ? 'C' : '…';
    document.querySelector('#another-button').hidden = false;
  } catch (error) {
    if (myRequest !== requestId || selectedFile !== file) return;
    console.error(error);
    result.innerHTML = '<h2>The check could not finish</h2><p>The model may be unavailable or this browser may not have enough resources. Your image remains selected and has not been uploaded.</p>';
    document.querySelector('#result-mark').textContent = '!';
    document.querySelector('#another-button').hidden = false;
    showNotice('Try again when you have a stable connection, or choose another image.');
  } finally {
    if (myRequest === requestId && selectedFile === file) analyze.disabled = false;
  }
}

function loadClassifier(progress_callback) {
  if (!classifierPromise) {
    classifierPromise = import('@huggingface/transformers').then(async ({ AutoModelForImageClassification, AutoProcessor, env }) => {
      env.allowLocalModels = false;
      const options = {
        revision: MODEL_CONFIG.revision,
        dtype: MODEL_CONFIG.dtype,
        progress_callback,
      };
      env.remoteHost = MODEL_CONFIG.remoteHost;
      const create = async (device) => {
        const [model, processor] = await Promise.all([
          AutoModelForImageClassification.from_pretrained(MODEL_CONFIG.id, { ...options, device }),
          AutoProcessor.from_pretrained(MODEL_CONFIG.id, options),
        ]);
        // The pinned processor config omits do_center_crop even though it declares
        // crop_size=384 and the ONNX model's positional embedding requires 384×384.
        processor.image_processor.do_center_crop = true;
        return { model, processor, backend: device === 'webgpu' ? 'WebGPU' : 'WASM' };
      };
      let preferredDevice = 'wasm';
      if (navigator.gpu) {
        try {
          if (await navigator.gpu.requestAdapter()) preferredDevice = 'webgpu';
        } catch {
          // Some browsers expose navigator.gpu but cannot provide an adapter.
        }
      }
      return create(preferredDevice)
        .catch((error) => {
          if (preferredDevice !== 'webgpu') throw error;
          console.warn('WebGPU initialization failed; retrying with WASM.', error);
          const status = document.querySelector('#model-status');
          if (status) status.textContent = 'GPU acceleration is unavailable here. Switching to the compatible browser runtime…';
          return create('wasm');
        });
    }).catch((error) => { classifierPromise = null; throw error; });
  }
  return classifierPromise;
}

function showNotice(message) { notice.textContent = message; notice.hidden = false; }
function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
