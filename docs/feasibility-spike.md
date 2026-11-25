# Phase 0 browser feasibility

- **Run date:** 2026-11-26 (Asia/Kolkata)
- **Decision:** Continue with the pinned model for this experimental prototype.
- **Browsers tested:** Headless Chrome 158 on Windows 10 x64, desktop viewport 1280 × 720. A 360 px viewport is covered by the browser smoke script; no physical mobile device was available in this environment.

## Configuration

- Model: `onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX`
- Model revision: `f9fc6516b37cd7d1bec3b94847b3682ce97249f0`
- ONNX file: `onnx/model_q4.onnx`; 24,430,903 transferred bytes in the clean-profile request
- Runtime package: `@huggingface/transformers@4.3.2`
- ONNX Runtime Web CDN asset observed: `1.31.0-dev.20260914-8d85527a0`
- Processor: RGB, shortest edge 440 px, 384 × 384 center crop, CLIP mean/std from the pinned preprocessor config
- Output: one binary logit. Upstream training labels are real 0 / fake 1. The UI uses the logit sign as an experimental boundary and never displays a probability.

## Results

The first inference attempt failed with an ONNX shape error: the export expected 577 tokens (384 × 384 plus the class token), while the preprocessor emitted 730 tokens from an uncropped 440 × 440 image. The pinned preprocessor file declares `crop_size: 384` but omits `do_center_crop`. Enabling that crop in the adapter aligned the tensor with the model, after which inference completed.

On a clean browser profile, the first check completed in about 22–26 seconds. The observed first-use network transfer was about 30.0 MB total: 24.43 MB for the Q4 model, 5.55 MB for the ONNX Runtime WebAssembly asset, and small configuration/runtime files. Model download and inference are both lazy; the landing-page request log showed no external requests before analysis. The inference portion took about 3.5 seconds on the first WebGPU run.

With the model already available in the browser profile:

- WebGPU: first run 3.5–3.7 s; two warm repeats 0.86–0.96 s.
- WASM: first run 3.7–4.0 s; subsequent repeats 2.9–3.1 s.
- A simulated missing WebGPU adapter selected WASM and completed inference.
- A browser request log showed no non-GET requests with a body and no request containing the selected image filename. The 1,370-byte synthetic image was generated and decoded locally.
- After a model/runtime cache was warm, all external HTTPS requests were blocked and the app was reloaded; inference still completed from the browser cache. This verifies cached offline reuse in this browser profile, not a fresh-install offline experience.
- Three repeated inferences per backend on that synthetic input produced the same raw logit within each backend (spread 0). The WebGPU and WASM raw logits differed by less than 0.000001.
- A NASA Artemis II Earthrise camera photo ([NASA ID `art002e009280b`](https://images.nasa.gov/details/art002e009280b)) ran locally and returned a raw negative logit close to zero. The app abstained within its experimental ±0.2 margin; this is a single qualitative check, not model validation. The test photo is not included in this repository.
- The browser-generated synthetic graphic returned an AI-like signal despite not being AI-generated, showing an observed false positive outside a photo evaluation set.

The smoke test also checks upload preview, drag and drop, visible keyboard focus, clear/reset, unsupported and corrupt image messaging, the 15 MB limit, and horizontal overflow. Browser-emulated mobile layout at 360 px had no horizontal overflow; it does not replace a physical iOS/Android browser test.

## Limits and follow-up

The model's published evaluation metrics are labeled unverified, and no held-out real/generated image set was evaluated here. Runtime success and repeated outputs do not establish detection quality. Offline behavior after a fresh install and physical mobile performance remain unverified. The model host and WASM runtime host add external download dependencies and bandwidth.
