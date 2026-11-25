import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profileDir = process.env.PROFILE_DIR ?? 'node_modules/.cache/image-check-smoke-profile';
const context = await chromium.launchPersistentContext(profileDir, { headless: true, executablePath: chromePath });
const page = context.pages()[0] ?? await context.newPage();
if (process.env.MOBILE === '1') await page.setViewportSize({ width: 360, height: 780 });
const requests = [];
page.on('request', (request) => requests.push({ method: request.method(), url: request.url(), bodyBytes: request.postDataBuffer()?.length ?? 0 }));
page.on('pageerror', (error) => requests.push({ method: 'pageerror', url: error.message, bodyBytes: 0 }));
await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.locator('#file-input').waitFor({ state: 'attached' });
await page.waitForTimeout(200);
const initialExternalRequests = requests.filter((request) => request.url.startsWith('http') && new URL(request.url).origin !== new URL(baseUrl).origin);
if (initialExternalRequests.length) throw new Error('The landing page made an unexpected external request.');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
const keyboardFocus = await page.evaluate(() => ({ target: document.activeElement?.id, outlineStyle: getComputedStyle(document.activeElement).outlineStyle }));
if (keyboardFocus.target !== 'choose-button' || keyboardFocus.outlineStyle === 'none') throw new Error('Upload action did not receive visible keyboard focus.');
const imagePath = process.env.IMAGE_PATH;
let selectedBytes;
if (imagePath) selectedBytes = await readFile(imagePath);
else {
  const pngDataUrl = await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
  const context = canvas.getContext('2d'); context.fillStyle = '#dce8ef'; context.fillRect(0, 0, 128, 96);
  context.fillStyle = '#315a73'; context.fillRect(17, 13, 90, 66);
    return canvas.toDataURL('image/png');
  });
  selectedBytes = Buffer.from(pngDataUrl.split(',')[1], 'base64');
}
const file = imagePath
  ? { name: imagePath.split(/[\\/]/).at(-1), mimeType: imagePath.toLowerCase().endsWith('.webp') ? 'image/webp' : imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg', buffer: selectedBytes }
  : { name: 'local-smoke.png', mimeType: 'image/png', buffer: selectedBytes };
await page.locator('#file-input').setInputFiles(file);
await page.locator('#preview-state').waitFor({ state: 'visible', timeout: 5_000 });
await page.getByRole('button', { name: 'Check this image' }).click();
const started = Date.now();
const scanAnimation = await page.waitForFunction(() => {
  const overlay = document.querySelector('.scan-overlay');
  const sweep = document.querySelector('.scan-sweep');
  return overlay && getComputedStyle(overlay).display !== 'none' && sweep && getComputedStyle(sweep).animationName === 'scanPass';
}, null, { timeout: 3_000 }).then(() => true).catch(() => false);
if (!scanAnimation) throw new Error('The image scan animation did not start.');
await page.waitForFunction(() => /AI origin recorded|Origin unknown|Credential failed validation|Credential found|Origin check unavailable/.test(document.querySelector('#result-content')?.innerText ?? ''), null, { timeout: 30_000 });
if (await page.locator('#drop-zone').evaluate((element) => element.classList.contains('is-scanning'))) throw new Error('The scan animation remained active after the result appeared.');
const resultText = await page.locator('#result-content').innerText();
if (/\b\d+\s*\/\s*100\b|Visual model signal|role="meter"/.test(resultText)) throw new Error('A numeric visual score is still being shown.');
if (process.env.IMAGE_PROVENANCE === 'ai-generated' && !resultText.includes('AI origin recorded')) throw new Error('Known AI origin was not surfaced in the main result.');
if (process.env.IMAGE_PROVENANCE === 'camera-photo' && !resultText.includes('Origin unknown')) throw new Error('Image without credentials was not shown as unknown origin.');
await page.waitForFunction(() => document.querySelectorAll('.visual-card img').length === 4 || document.querySelector('#visual-grid')?.innerText.includes('unavailable'), null, { timeout: 15_000 });
if (await page.locator('.visual-card img').count() !== 4) throw new Error('The four exploratory image maps were not rendered.');
await page.waitForFunction(() => !document.querySelector('#provenance-card .evidence-status')?.innerText.includes('Checking credentials'), null, { timeout: 5_000 });
const provenanceEvidence = await page.locator('#provenance-card').innerText();
const elapsedToResultMs = Date.now() - started;
await mkdir('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/phase0-result.png', fullPage: true });
const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
const viewportWidth = await page.evaluate(() => innerWidth);
if (pageWidth > viewportWidth) throw new Error(`Horizontal overflow at ${viewportWidth}px: document is ${pageWidth}px wide.`);
await page.getByRole('button', { name: 'Remove selected image' }).click();
if (await page.locator('#preview-state').isVisible()) throw new Error('Remove action did not clear the preview.');
if (!(await page.getByRole('button', { name: 'Check this image' }).isDisabled())) throw new Error('Remove action did not disable analysis.');
const pngDataUrl = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; return canvas.toDataURL('image/png'); });
const png = Buffer.from(pngDataUrl.split(',')[1], 'base64');
await page.locator('#drop-zone').evaluate((element, encoded) => { const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'dropped.png', { type: 'image/png' })); element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer })); element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer })); }, png.toString('base64'));
if (!(await page.locator('#preview-state').isVisible())) throw new Error('Drag-and-drop selection did not show the preview.');
await page.getByRole('button', { name: 'Remove selected image' }).click();
await page.locator('#file-input').setInputFiles({ name: 'unsupported.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('not a supported'), null, { timeout: 5_000 });
await page.locator('#file-input').setInputFiles({ name: 'corrupt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]) });
await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('could not be decoded'), null, { timeout: 5_000 });
await page.locator('#file-input').setInputFiles({ name: 'oversized.png', mimeType: 'image/png', buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
await page.waitForFunction(() => document.querySelector('#notice')?.textContent.includes('larger than 15 MB'), null, { timeout: 5_000 });
const externalPosts = requests.filter((request) => request.method !== 'GET' && request.bodyBytes > 0);
if (externalPosts.length || requests.some((request) => imagePath && request.url.includes(file.name))) throw new Error('The selected image was sent to an external service.');
const report = {
  date: `${new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' })} Asia/Kolkata`,
  browser: await page.evaluate(() => navigator.userAgent),
  viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio, pageWidth: document.documentElement.scrollWidth })),
  interactions: { keyboardFocusVisible: keyboardFocus, previewAppeared: true, dragAndDropWorks: true, clearDisabledAnalysis: true, unsupportedFileMessage: true, corruptImageMessage: true, oversizedFileMessage: true },
  landingExternalRequestsBeforeAnalysis: initialExternalRequests,
  image: { name: file.name, bytes: selectedBytes.byteLength, generatedLocally: !imagePath, expectedOrigin: process.env.IMAGE_PROVENANCE ?? null },
  outcome: resultText,
  provenanceEvidence,
  elapsedToResultMs,
  externalRequestsWithPayload: externalPosts,
  appImageUploadVerified: true,
};
await writeFile('artifacts/phase0-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await context.close();
