# Detector evaluation and metadata evidence

## Current product behavior

Traceframe reports evidence saved with the image. It does not infer “real” from a missing credential or metadata tag, and it does not show a visual AI probability.

The metadata reader checks EXIF, XMP, IPTC, and PNG text metadata for recognized generator names or generation fields. It reports camera-related fields separately. These values can be removed or edited, so they are hints rather than proof. All parsing happens in the browser.

## Supplied reference images

The user supplied a known AI-generated PNG and a camera JPEG they identified as original.

- The AI image contains a C2PA Content Credential recording AI generation. This is stronger evidence than a visual classifier when the credential validates.
- The camera JPEG has no C2PA credential and no EXIF/XMP/IPTC metadata. Its missing camera metadata is consistent with the image having been shared through WhatsApp, but does not prove how it was made.
- A previously pinned browser visual classifier returned 9/100 for the AI image and 0/100 for the camera image. Since both values were on the same low end, it failed to distinguish these examples.
- The user-supplied Python repository `image_detecter_09` was run locally on both files. Its handcrafted detector returned 82.4% AI for the generated image and 78.4% AI for the camera image. It therefore also failed to distinguish them.

## Python baseline review

The repository’s detector combines hand-authored metadata, FFT, error-level, noise-residual, and color heuristics with manually set weights and a sigmoid. It is not a trained classifier, and its returned percentage is not calibrated against a held-out test set. Camera EXIF lowers the score, so an image with stripped metadata can lose that clue.

The sample generator creates its “real” sample with camera-like texture and camera EXIF, while its generated samples include designed synthetic patterns and generation metadata. The test suite checks that routes return successfully and that fields exist; it does not assert correct AI/real labels. This can make the bundled demo appear stronger than it is on ordinary shared images.

## Research implications

- The [CO-SPY CVPR 2025 paper](https://openaccess.thecvf.com/content/CVPR2025/html/Cheng_CO-SPY_Combining_Semantic_and_Pixel_Features_to_Detect_Synthetic_Images_CVPR_2025_paper.html) combines semantic and pixel-level signals. It reports that pixel-artifact detectors can lose accuracy after JPEG compression, while semantic detectors can struggle with unfamiliar generators and content.
- [Community Forensics (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/html/Park_Community_Forensics_Using_Thousands_of_Generators_to_Train_Fake_Image_CVPR_2025_paper.html) evaluates training diversity across thousands of generators, reinforcing that a few hand-picked samples are not enough to validate a detector.
- The [NTIRE 2026 robustness challenge](https://arxiv.org/abs/2604.11487) evaluates 42 generators across 36 transformations. Its strongest submissions use large vision backbones and extensive, diverse training and augmentation. That class of model is not a small browser-side addition to this Vercel prototype.

These findings support retaining visible forensic maps as exploratory views, not turning them into a yes/no decision. A credible visual detector would need broad labeled data, held-out generators, common sharing transformations, false-positive reporting, and model/runtime evaluation before integration.

## Attribution

The Python repository was inspected and used as a baseline only. Its repository does not include a license file, so this project does not copy its detector source. Traceframe independently reads metadata and labels the clues without assigning them a probability.
