let runtimePromise;

// Reads Content Credentials directly from the selected file. No image bytes are
// sent to a service; the SDK and its WASM runtime are bundled with the app.
export async function inspectProvenance(file) {
  const [{ createC2pa, Reader }, wasmModule] = await Promise.all([
    import('@contentauth/c2pa-web'),
    import('@contentauth/c2pa-web/resources/c2pa.wasm?url'),
  ]);
  if (!runtimePromise) runtimePromise = createC2pa({ wasmSrc: wasmModule.default });
  const c2pa = await runtimePromise;
  let reader;
  try {
    reader = await Reader.fromBlob(c2pa, file.type, file);
    const store = await reader.manifestStore();
    const activeRef = store?.activeManifest ?? store?.active_manifest;
    const active = typeof activeRef === 'string'
      ? store?.manifests?.[activeRef]
      : activeRef;
    if (!active) return { status: 'absent' };
    // C2PA reader releases have represented assertion payloads as either
    // parsed objects or serialized/normalized data. Search only the active
    // manifest and require an explicit IPTC digital source type before calling
    // it AI-origin evidence.
    const activeText = JSON.stringify(active).toLowerCase();
    const generated = activeText.includes('trainedalgorithmicmedia');
    const validation = store.validationStatus ?? store.validation_status ?? [];
    const invalid = validation.some((item) => /invalid|failure|mismatch/i.test(`${item.code ?? ''} ${item.explanation ?? ''}`));
    const generator = active.claim_generator_info?.[0]?.name ?? active.claim_generator ?? active.claimGeneratorInfo?.[0]?.name;
    return { status: invalid ? 'invalid' : 'found', generated, title: active.title, generator, validation };
  } catch (error) {
    // A file without a recognized manifest is common. Keep parser/runtime errors
    // distinct so they are never presented as proof that credentials are absent.
    if (/manifest|c2pa|claim|ingredient|assertion|format|not found/i.test(String(error?.message))) return { status: 'absent' };
    return { status: 'unavailable', message: error?.message ?? 'Could not inspect credentials.' };
  } finally {
    await reader?.free?.();
  }
}
