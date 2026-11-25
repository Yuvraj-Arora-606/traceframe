# Visual detector evaluation and retirement

- **Status:** Retired from the user interface; no visual AI score is shown.
- **Updated:** 2026-11-26 (Asia/Kolkata)

The pinned Community Forensics model ran in the browser, but the two supplied reference images showed that its output was not useful for this product: the known AI-generated image returned 9/100 and the supplied camera photo returned 0/100. Both fell at the low end of the same scale, and the AI image was a false negative for visual detection.

The AI image did contain a Content Credential recording AI generation, signed under a generator name reported as OpenAI Media Service API. The credential reader originally missed it because the active manifest was a reference; that parsing issue has been fixed. The camera photo had no Content Credential. Absence of a credential does not establish camera origin.

The score was removed instead of being relabeled as a probability or converted into a categorical verdict. Still / Signal now reports available provenance evidence and uses **Origin unknown** when no usable origin record is present. It makes no broad image-authenticity or AI-detection accuracy claim.

Earlier browser and model experiments are retained in [the feasibility spike](feasibility-spike.md) for reference. They describe historical experiments, not the current product behavior.
