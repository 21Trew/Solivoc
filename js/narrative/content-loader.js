/* Runtime World content contract. Design docs remain the authored source; runtime reads only exported content. */
(() => {
  const ROOT = "./content/worlds";
  const SUPPORTED_SCHEMA = 1;

  function validateManifest(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("manifest_not_object");
    if (value?.schemaVersion !== SUPPORTED_SCHEMA) errors.push("unsupported_schema_version");
    if (!/^[a-z0-9_-]+$/.test(String(value?.worldId || ""))) errors.push("invalid_world_id");
    if (!/^\d+\.\d+$/.test(String(value?.packageVersion || ""))) errors.push("invalid_package_version");
    if (!value?.source?.designArchive) errors.push("missing_design_archive");
    if (!Array.isArray(value?.runtimeFiles)) errors.push("missing_runtime_files");
    return { ok: errors.length === 0, errors };
  }

  async function loadManifest(worldId = "forest", version = "0.03") {
    const safeWorld = String(worldId).replace(/[^a-z0-9_-]/g, "");
    const safeVersion = String(version).replace(/[^0-9.]/g, "");
    const response = await fetch(`${ROOT}/${safeWorld}/v${safeVersion}/package.manifest.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`content_manifest_${response.status}`);
    const manifest = await response.json();
    const validation = validateManifest(manifest);
    if (!validation.ok) throw Object.assign(new Error("invalid_content_manifest"), { validation });
    return Object.freeze(manifest);
  }

  window.SolivocWorldContent = Object.freeze({ loadManifest, validateManifest, supportedSchema: SUPPORTED_SCHEMA });
})();
