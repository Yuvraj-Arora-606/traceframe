import { describe, expect, it } from 'vitest';
import { summarizeImageMetadata } from './image-metadata.js';

describe('image metadata clues', () => {
  it('reports generator and prompt tags as unverified AI clues', () => {
    const result = summarizeImageMetadata({
      xmp: {
        Software: { value: 'ComfyUI' },
        Prompt: { value: 'A mountain at sunrise' },
      },
    });

    expect(result.aiHints).toEqual(['ComfyUI', 'Prompt metadata']);
    expect(result.cameraDetails).toEqual([]);
  });

  it('reports camera fields separately from AI-generation clues', () => {
    const result = summarizeImageMetadata({
      exif: {
        Make: { value: 'Canon' },
        Model: { value: 'Canon EOS R6' },
        DateTimeOriginal: { value: '2025:01:01 12:00:00' },
      },
    });

    expect(result.aiHints).toEqual([]);
    expect(result.cameraDetails).toEqual(['Canon', 'Canon EOS R6', '2025:01:01 12:00:00']);
  });

  it('does not treat an empty metadata set as evidence of a camera or AI origin', () => {
    expect(summarizeImageMetadata({})).toEqual({ aiHints: [], cameraDetails: [], metadataCount: 0 });
  });

  it('does not count file-format details as camera or origin metadata', () => {
    expect(summarizeImageMetadata({
      file: { FileType: { value: 'JPEG' } },
      jfif: { DensityUnit: { value: 'Pixels per inch' } },
    })).toEqual({ aiHints: [], cameraDetails: [], metadataCount: 0 });
  });
});
