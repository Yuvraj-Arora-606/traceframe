// Pin all model/runtime details here so changes are reviewable.
export const MODEL_CONFIG = Object.freeze({
  id: 'onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX',
  revision: 'f9fc6516b37cd7d1bec3b94847b3682ce97249f0',
  modelFile: 'onnx/model_q4.onnx',
  dtype: 'q4',
  runtime: '@huggingface/transformers@4.3.2',
  onnxRuntimeWeb: '1.31.0-dev.20260914-8d85527a0',
  preprocessing: 'RGB; shortest edge 440; center crop 384×384; CLIP normalization',
  remoteHost: import.meta.env.VITE_MODEL_BASE_URL || 'https://huggingface.co',
  output: 'one binary logit; positive values map to the AI-generated class',
  decisionBoundary: 0,
  inconclusiveMargin: 0.2,
  labelSource: 'https://github.com/JeongsooP/Community-Forensics/blob/main/dataloader.py',
  decisionBoundaryValidated: false,
});
