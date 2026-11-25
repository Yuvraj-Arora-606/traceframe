import ExifReader from 'exifreader';

const AI_GENERATOR_PATTERN = /stable\s*diffusion|midjourney|dall[\s-]?e|comfyui|automatic1111|invokeai|novelai|leonardo(?:\.ai)?|adobe\s*firefly|flux(?:\.\d)?|openai\s*(?:image|media)/i;
const AI_PARAMETER_TAG_PATTERN = /^(?:prompt|negative prompt|generation data|generation parameters|model hash|steps|sampler|cfg scale|workflow)$/i;
const CAMERA_TAG_NAMES = new Set([
  'make', 'model', 'lensmodel', 'datetimeoriginal', 'exposuretime',
  'fnumber', 'isospeedratings', 'photographic sensitivity',
]);
const TECHNICAL_TAG_NAMES = new Set([
  'image width', 'image height', 'bit depth', 'color type', 'compression',
  'filter', 'interlace', 'progressive', 'progression', 'x resolution',
  'y resolution', 'resolution unit', 'file type', 'filetype',
]);

function cleanValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(cleanValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
}

function flattenTags(value, path = [], rows = []) {
  if (!value || typeof value !== 'object') return rows;
  for (const [key, entry] of Object.entries(value)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry) && ('value' in entry || 'description' in entry)) {
      const tagValue = cleanValue(entry.description) || cleanValue(entry.value);
      if (tagValue) rows.push({ name: key, path: [...path, key].join('.'), value: tagValue });
    } else if (Array.isArray(entry)) {
      const tagValue = cleanValue(entry);
      if (tagValue) rows.push({ name: key, path: [...path, key].join('.'), value: tagValue });
    } else if (entry && typeof entry === 'object') {
      flattenTags(entry, [...path, key], rows);
    } else {
      const tagValue = cleanValue(entry);
      if (tagValue) rows.push({ name: key, path: [...path, key].join('.'), value: tagValue });
    }
  }
  return rows;
}

function normalizeTagName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function summarizeImageMetadata(tags) {
  const rows = flattenTags(tags);
  const meaningfulRows = rows.filter((row) => {
    const group = row.path.split('.')[0].toLowerCase();
    return !['file', 'jfif', 'pngfile', 'icc'].includes(group)
      && !TECHNICAL_TAG_NAMES.has(row.name.toLowerCase());
  });
  const aiHints = [];
  for (const row of rows) {
    if (AI_GENERATOR_PATTERN.test(row.value)) {
      const hint = row.value.match(AI_GENERATOR_PATTERN)?.[0];
      if (hint && !aiHints.some((existing) => existing.toLowerCase() === hint.toLowerCase())) aiHints.push(hint);
    } else if (AI_PARAMETER_TAG_PATTERN.test(row.name)) {
      aiHints.push(`${row.name} metadata`);
    }
  }

  const cameraDetails = [];
  for (const row of rows) {
    if (!row.path.toLowerCase().startsWith('exif.') || !CAMERA_TAG_NAMES.has(normalizeTagName(row.name))) continue;
    if (!cameraDetails.some((detail) => detail.toLowerCase() === row.value.toLowerCase())) cameraDetails.push(row.value);
  }

  return {
    aiHints: [...new Set(aiHints)].slice(0, 4),
    cameraDetails: cameraDetails.slice(0, 4),
    metadataCount: meaningfulRows.length,
  };
}

export async function inspectImageMetadata(file) {
  try {
    const tags = await ExifReader.load(file, { expanded: true });
    return { status: 'read', ...summarizeImageMetadata(tags) };
  } catch (error) {
    return { status: 'unavailable', aiHints: [], cameraDetails: [], metadataCount: 0, message: error?.message ?? 'Could not read image metadata.' };
  }
}
