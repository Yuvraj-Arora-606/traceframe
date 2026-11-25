# Model validation status

- **Status:** Not validated for public reliability claims.
- **Updated:** 2026-11-26 (Asia/Kolkata)

The browser feasibility spike confirms that the pinned Q4 ONNX file can load and run in the tested desktop Chromium environment after enabling the crop declared by the model processor config. It does not measure classifier accuracy or establish thresholds for real images.

The current label direction follows the upstream binary training setup (`real: 0, fake: 1`). The app uses the raw logit sign as its default binary boundary, with an experimental ±0.2 logit abstention margin, and displays only “AI-like signal,” “Camera-like signal,” or “Inconclusive.” It does not display the logit, sigmoid value, or a percentage. These boundaries are prototype defaults, not held-out-data operating points. Results can be wrong, especially on unseen generators, edited or recompressed images, and out-of-domain content.

Before any public reliability claim, assemble a legally usable held-out set with camera-originated and generated images from distinct sources and generator families. Include resizing, recompression, and screenshot-like transformations; select thresholds on separate data; report false-positive/false-negative rates, recall, balanced accuracy, per-source results, and the abstention rate. Calibration is required before showing probabilities. This prototype has not completed that study and should be presented as an experiment only.

The synthetic 128 × 96 canvas graphic used for smoke testing produced an AI-like signal despite not being an AI-generated image. A NASA Artemis II Earthrise camera photograph returned a negative logit that falls inside the app's experimental inconclusive margin. Both observations illustrate why this prototype cannot settle image authenticity. Repeated runs were deterministic on those inputs; they are runtime checks, not an evaluation set or evidence of detector performance.
