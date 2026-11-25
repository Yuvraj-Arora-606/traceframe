import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profileDir = process.env.PROFILE_DIR ?? 'node_modules/.cache/image-check-smoke-profile';
const forceWasm = process.env.FORCE_WASM === '1';
const failWebgpu = process.env.FAIL_WEBGPU === '1';
const offlineReplay = process.env.OFFLINE_REPLAY === '1';
const context = await chromium.launchPersistentContext(profileDir, { headless: true, executablePath: chromePath, args: ['--enable-unsafe-webgpu'] });
const page = context.pages()[0] ?? await context.newPage();
if (process.env.MOBILE === '1') await page.setViewportSize({ width: 360, height: 780 });
if (forceWasm) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }));
if (failWebgpu) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { configurable: true, value: { requestAdapter: async () => null } }));
if (offlineReplay) await context.route('https://**/*', (route) => route.abort('internetdisconnected'));
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
const requests = [];
const responseSizes = [];
const consoleMessages = [];
const networkUrls = new Map();
cdp.on('Network.requestWillBeSent', (event) => networkUrls.set(event.requestId, event.request.url));
cdp.on('Network.loadingFinished', (event) => {
  const url = networkUrls.get(event.requestId);
  if (!url) return;
  const parsed = new URL(url);
  if (parsed.origin !== new URL(baseUrl).origin) {
    responseSizes.push({ host: parsed.host, path: parsed.pathname, transferredBytes: event.encodedDataLength });
  }
});
page.on('request', (request) => requests.push({ method: request.method(), url: request.url(), bodyBytes: request.postDataBuffer()?.length ?? 0 }));
page.on('console', (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => consoleMessages.push({ type: 'pageerror', text: error.message }));
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.locator('#file-input').waitFor({ state: 'attached' });
if (process.env.MOBILE === '1') await page.setViewportSize({ width: 360, height: 780 });
await page.waitForTimeout(250);
const initialExternalRequests = requests.filter((request) => new URL(request.url).origin !== new URL(baseUrl).origin);
if (initialExternalRequests.length) throw new Error('The landing page made an unexpected external request before analysis.');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
const keyboardFocus = await page.evaluate(() => ({ target: document.activeElement?.id, outlineStyle: getComputedStyle(document.activeElement).outlineStyle }));
if (keyboardFocus.target !== 'choose-button' || keyboardFocus.outlineStyle === 'none') throw new Error('Upload action did not receive visible keyboard focus.');
const webgpuAvailable = await page.evaluate(() => Boolean(navigator.gpu));
const pngDataUrl = await page.evaluate(() => {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = '#dce8ef'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#315a73'; context.fillRect(17, 13, 90, 66);
  context.fillStyle = '#e2b179'; context.beginPath(); context.arc(61, 44, 20, 0, Math.PI * 2); context.fill();
  return canvas.toDataURL('image/png');
});
const png = Buffer.from(pngDataUrl.split(',')[1], 'base64');
const imagePath = process.env.IMAGE_PATH;
const selectedBytes = imagePath ? await readFile(imagePath) : png;
const file = imagePath
  ? { name: imagePath.split(/[\\/]/).at(-1), mimeType: imagePath.toLowerCase().endsWith('.webp') ? 'image/webp' : imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg', buffer: selectedBytes }
  : { name: 'local-smoke.png', mimeType: 'image/png', buffer: selectedBytes };
await page.locator('#file-input').setInputFiles(file);
await page.locator('#preview-state').waitFor({ state: 'visible', timeout: 5_000 }).catch(async () => { throw new Error(`Selected image preview did not become visible: ${await page.locator('#notice').innerText()}`); });
await page.getByRole('button', { name: 'Check this image' }).click();
const started = Date.now();
await page.waitForFunction(() => /AI-like signal|Camera-like signal|Inconclusive|The check could not finish/.test(document.querySelector('#result-content')?.innerText ?? ''), { timeout: 180_000 });
const wallMs = Date.now() - started;
for (let run = 1; run < 3 && !await page.getByText('The check could not finish').count(); run++) {
  const completed = page.waitForEvent('console', { predicate: (message) => message.text().includes('inference_ms') });
  await page.getByRole('button', { name: 'Check this image' }).click();
  await completed;
}
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/phase0-result.png', fullPage: true });
const resultText = await page.locator('#result-content').innerText();
const modelDownloadFailed = resultText.includes('The check could not finish');
const downloadFailureNotice = modelDownloadFailed ? await page.locator('#notice').innerText() : null;
const retryEnabled = !(await page.getByRole('button', { name: 'Check this image' }).isDisabled());
if (modelDownloadFailed && (!downloadFailureNotice?.includes('stable connection') || !retryEnabled)) {
  throw new Error('Model-download failure did not leave an actionable message and retry option.');
}
const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
const viewportWidth = await page.evaluate(() => innerWidth);
if (pageWidth > viewportWidth) throw new Error(`Horizontal overflow at ${viewportWidth}px: document is ${pageWidth}px wide.`);
await page.getByRole('button', { name: 'Remove selected image' }).click();
if (await page.locator('#preview-state').isVisible()) throw new Error('Remove action did not clear the preview.');
if (!(await page.getByRole('button', { name: 'Check this image' }).isDisabled())) throw new Error('Remove action did not disable analysis.');
await page.locator('#drop-zone').evaluate((element, encoded) => {
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
  element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
  element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
}, png.toString('base64'));
if (!(await page.locator('#preview-state').isVisible())) throw new Error('Drag-and-drop selection did not show the preview.');
await page.getByRole('button', { name: 'Remove selected image' }).click();
await page.locator('#file-input').setInputFiles({ name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
if (!(await page.locator('#notice').innerText()).includes('not a supported')) throw new Error('Unsupported-file recovery message was not shown.');
await page.locator('#file-input').setInputFiles({ name: 'corrupt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) });
await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('could not be decoded'), { timeout: 5_000 }).catch(() => { throw new Error('Corrupt-image recovery message was not shown.'); });
await page.locator('#file-input').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
if (!(await page.locator('#notice').innerText()).includes('larger than 15 MB')) throw new Error('Oversized-file recovery message was not shown.');
const externalPosts = requests.filter((request) => request.method !== 'GET' && request.bodyBytes > 0);
const runLogs = consoleMessages.filter((item) => item.text.includes('inference_ms'));
const logits = runLogs.map((item) => Number(item.text.match(/logit (-?[\d.]+)/)?.[1])).filter(Number.isFinite);
const adapterInfo = await page.evaluate(async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return null;
    return adapter.info ?? await adapter.requestAdapterInfo?.() ?? null;
  } catch { return null; }
});
const report = {
  date: `${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })} Asia/Kolkata`,
  browser: await page.evaluate(() => navigator.userAgent),
  viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio, pageWidth: document.documentElement.scrollWidth })),
  interactionChecks: { keyboardFocusVisible: keyboardFocus, previewAppeared: true, dragAndDropWorks: true, clearDisabledAnalysis: true, unsupportedFileMessage: true, corruptImageMessage: true, oversizedFileMessage: true, modelDownloadFailureRecovered: modelDownloadFailed ? { notice: downloadFailureNotice, retryEnabled } : null },
  landingExternalRequestsBeforeAnalysis: initialExternalRequests,
  webgpuAvailable,
  adapterInfo,
  expectedBackend: failWebgpu ? 'WebGPU adapter failure; expect WASM fallback' : forceWasm ? 'WASM (forced)' : webgpuAvailable ? 'WebGPU preferred; fallback permitted' : 'WASM',
  offlineReplay,
  image: { name: file.name, bytes: selectedBytes.byteLength, generatedLocally: !imagePath, provenance: process.env.IMAGE_PROVENANCE ?? null, credit: process.env.IMAGE_CREDIT ?? null },
  outcome: resultText,
  elapsedToResultMs: wallMs,
  modelResponses: responseSizes,
  totalExternalTransferredBytes: responseSizes.reduce((total, item) => total + item.transferredBytes, 0),
  measuredInferenceMs: Number(consoleMessages.find((item) => item.text.includes('inference_ms'))?.text.match(/inference_ms (\d+)/)?.[1] ?? null),
  repeatedInferenceMs: runLogs.map((item) => Number(item.text.match(/inference_ms (\d+)/)?.[1] ?? null)),
  rawModelLogitsForSelectedImage: logits,
  repeatedLogitSpread: logits.length > 1 ? Math.max(...logits) - Math.min(...logits) : null,
  externalRequestsWithPayload: externalPosts,
  appImageUploadVerified: externalPosts.length === 0 && !requests.some((request) => request.url.includes(file.name)),
  consoleMessages,
};
await writeFile('artifacts/phase0-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await context.close();
