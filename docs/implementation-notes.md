# Implementation notes

## Frontend design skill

Used Anthropic's official `frontend-design` skill: [anthropics/skills, `skills/frontend-design/SKILL.md`](https://github.com/anthropics/skills/tree/main/skills/frontend-design). It was retrieved from the `main` branch on 2026-11-25 using the supported Codex skill installer. The upstream skill does not publish a semantic version; `main` is the recorded source ref. Its guidance informed the restrained blue/graphite palette, image-centered inspection surface, plain language, and restrained motion. Product-specific accessibility and privacy requirements from the PRD take precedence.

## Runtime compatibility correction

At the pinned model revision, the processor config has `crop_size: 384` but omits `do_center_crop`. Transformers.js therefore resized the image to 440 × 440 and passed 730 tokens to a model whose positional embedding expects 577. The adapter sets `processor.image_processor.do_center_crop = true` so the configured 384 × 384 center crop is applied. This matches the model's documented preprocessing and passed inference in WebGPU and WASM.

## Decision boundary

The model returns one raw binary logit. The source training setup uses label 1 for fake/generated imagery, so positive logits map to an AI-like signal. A zero logit is the default sigmoid 0.5 binary boundary; an experimental ±0.2 neutral band provides an inconclusive result near that boundary. Neither value was selected on held-out data. The app does not call the logit a probability, show a score, or claim calibration.
