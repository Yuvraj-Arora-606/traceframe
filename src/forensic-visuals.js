const SIZE = 128;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image for visual diagnostics.')); };
    image.src = url;
  });
}

function canvasWithPixels(image) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, SIZE, SIZE);
  return { canvas, context, pixels: context.getImageData(0, 0, SIZE, SIZE) };
}

function mapCanvas(pixels, transform) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const output = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = transform(pixels.data, i);
    output.data[i] = r; output.data[i + 1] = g; output.data[i + 2] = b; output.data[i + 3] = 255;
  }
  ctx.putImageData(output, 0, 0);
  return canvas.toDataURL('image/png');
}

function fft(values) {
  const n = values.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [values[i], values[j]] = [values[j], values[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wr0 = Math.cos(angle), wi0 = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wr = 1, wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const even = values[start + j], odd = values[start + j + len / 2];
        const tr = wr * odd[0] - wi * odd[1], ti = wr * odd[1] + wi * odd[0];
        values[start + j] = [even[0] + tr, even[1] + ti];
        values[start + j + len / 2] = [even[0] - tr, even[1] - ti];
        [wr, wi] = [wr * wr0 - wi * wi0, wr * wi0 + wi * wr0];
      }
    }
  }
  return values;
}

function spectrumMap(pixels) {
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    const row = [];
    for (let x = 0; x < SIZE; x++) {
      const k = (y * SIZE + x) * 4;
      row.push([(pixels.data[k] * .299 + pixels.data[k + 1] * .587 + pixels.data[k + 2] * .114) / 255, 0]);
    }
    rows.push(fft(row));
  }
  for (let x = 0; x < SIZE; x++) {
    const col = fft(rows.map((row) => row[x]));
    for (let y = 0; y < SIZE; y++) rows[y][x] = col[y];
  }
  const mag = new Float32Array(SIZE * SIZE); let max = 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const sy = (y + SIZE / 2) % SIZE, sx = (x + SIZE / 2) % SIZE;
    const [re, im] = rows[sy][sx];
    const m = Math.log1p(Math.hypot(re, im)); mag[y * SIZE + x] = m; max = Math.max(max, m);
  }
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d'), out = ctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < mag.length; i++) {
    const t = Math.min(1, mag[i] / max); // restrained inferno-like palette
    out.data[i * 4] = Math.round(255 * Math.min(1, t * 1.8));
    out.data[i * 4 + 1] = Math.round(180 * Math.max(0, Math.min(1, (t - .2) * 1.5)));
    out.data[i * 4 + 2] = Math.round(220 * Math.max(0, Math.min(1, (t - .55) * 2.2)));
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

async function elaMap(image) {
  const { canvas, context, pixels } = canvasWithPixels(image);
  const jpeg = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .9));
  if (!jpeg) throw new Error('Browser could not create the compression comparison.');
  const compressed = await createImageBitmap(jpeg);
  context.clearRect(0, 0, SIZE, SIZE); context.drawImage(compressed, 0, 0, SIZE, SIZE); compressed.close();
  const recompressed = context.getImageData(0, 0, SIZE, SIZE);
  let max = 1;
  for (let i = 0; i < pixels.data.length; i += 4) max = Math.max(max, ...[0, 1, 2].map((c) => Math.abs(pixels.data[i + c] - recompressed.data[i + c])));
  return mapCanvas(pixels, (data, i) => { const d = Math.min(255, Math.max(Math.abs(data[i] - recompressed.data[i]), Math.abs(data[i + 1] - recompressed.data[i + 1]), Math.abs(data[i + 2] - recompressed.data[i + 2])) * 255 / max * 3); return [d, d * .34, 15]; });
}

export async function makeForensicVisuals(file) {
  const image = await loadImage(file);
  const { pixels } = canvasWithPixels(image);
  const highPass = mapCanvas(pixels, (data, i) => {
    const p = i / 4, x = p % SIZE, y = Math.floor(p / SIZE), gray = (k) => data[k] * .299 + data[k + 1] * .587 + data[k + 2] * .114;
    const center = gray(i), left = gray((y * SIZE + Math.max(0, x - 1)) * 4), right = gray((y * SIZE + Math.min(SIZE - 1, x + 1)) * 4);
    const up = gray((Math.max(0, y - 1) * SIZE + x) * 4), down = gray((Math.min(SIZE - 1, y + 1) * SIZE + x) * 4);
    const v = Math.min(255, Math.abs(center * 4 - left - right - up - down) * 2.5); return [v, v * .78, v * .48];
  });
  const color = mapCanvas(pixels, (data, i) => {
    const hi = Math.max(data[i], data[i + 1], data[i + 2]), lo = Math.min(data[i], data[i + 1], data[i + 2]);
    const sat = hi ? (hi - lo) / hi : 0, v = Math.round(sat * 255); return [v, Math.round((1 - Math.abs(sat - .5) * 2) * 120), 255 - v];
  });
  return { ela: await elaMap(image), noise: highPass, fft: spectrumMap(pixels), color };
}
