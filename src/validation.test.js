import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyImage, MAX_BYTES, MAX_PIXELS, classifySignal, validateImage } from './validation.js';

describe('image validation primitives', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('recognizes JPEG, PNG, and WebP from file bytes', () => {
    expect(identifyImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(identifyImage(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe('image/png');
    expect(identifyImage(Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe('image/webp');
    expect(identifyImage(Uint8Array.from([0, 1, 2, 3]))).toBeNull();
  });
  it('documents prototype resource caps', () => {
    expect(MAX_BYTES).toBe(15 * 1024 * 1024);
    expect(MAX_PIXELS).toBe(25_000_000);
  });
  it('rejects oversized and unsupported files before decoding', async () => {
    const oversized = new File([new Uint8Array(MAX_BYTES + 1)], 'huge.png', { type: 'image/png' });
    await expect(validateImage(oversized)).rejects.toThrow('larger than 15 MB');
    const unsupported = new File([Uint8Array.from([1, 2, 3, 4])], 'notes.txt', { type: 'image/png' });
    await expect(validateImage(unsupported)).rejects.toThrow('not a supported JPEG, PNG, or WebP');
  });
  it('rejects images over the megapixel cap after decoding dimensions', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 5001, height: 5000, close() {} }));
    const pngHeader = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const oversizedDimensions = new File([pngHeader], 'large.png', { type: 'image/png' });
    await expect(validateImage(oversizedDimensions)).rejects.toThrow('larger than 25 megapixels');
  });
  it('maps the single raw logit without presenting it as a probability', () => {
    expect(classifySignal(2.4)).toBe('ai-like');
    expect(classifySignal(-1.8)).toBe('camera-like');
    expect(classifySignal(0)).toBe('inconclusive');
    expect(classifySignal(0.1)).toBe('inconclusive');
    expect(classifySignal(-0.1)).toBe('inconclusive');
    expect(classifySignal(0.2)).toBe('inconclusive');
    expect(classifySignal(-0.2)).toBe('inconclusive');
    expect(classifySignal(Number.NaN)).toBe('inconclusive');
    expect(classifySignal(null)).toBe('inconclusive');
  });
});
