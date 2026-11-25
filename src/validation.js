import { MODEL_CONFIG } from './model-config.js';

export const MAX_BYTES = 15 * 1024 * 1024;
export const MAX_PIXELS = 25_000_000;

export function identifyImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'image/png';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function validateImage(file) {
  if (!file) throw new Error('Choose an image to continue.');
  if (file.size > MAX_BYTES) throw new Error('This image is larger than 15 MB. Choose a smaller file.');
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = identifyImage(bytes);
  if (!mime) throw new Error('This file is not a supported JPEG, PNG, or WebP image.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('The image could not be decoded. Try exporting it again as JPEG, PNG, or WebP.'); }
  const { width, height } = bitmap;
  bitmap.close();
  if (width * height > MAX_PIXELS) throw new Error('This image is larger than 25 megapixels. Choose a smaller image.');
  return { mime, width, height };
}

export function classifySignal(output) {
  if (typeof output !== 'number' || !Number.isFinite(output) || output === 0) return 'inconclusive';
  // Binary BCE classifier boundary: logit 0 maps to the default 0.5 decision boundary.
  // The neutral band is an experimental abstention margin, not a validated operating point.
  if (Math.abs(output) <= MODEL_CONFIG.inconclusiveMargin) return 'inconclusive';
  return output > 0 ? 'ai-like' : 'camera-like';
}
