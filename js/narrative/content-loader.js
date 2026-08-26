/* Runtime World content contract. Design docs remain the authored source; runtime reads only exported content. */
(() => {
  const ROOT = "./content/worlds";
  const SUPPORTED_SCHEMA = 1;
  const RULES_SCHEMA = 1;
  const RULES_FILE = "data/rules.json";
  const RULE_TYPE = "explicit-pairs";
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;

  function uniqueStrings(value) {
    if (value == null) return [];
    const list = Array.isArray(value) ? value : [value];
    return [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  function safeRuntimePath(value) {
    const path = String(value || "");
    return !!path && !path.startsWith("/") && !path.includes("..") && /^[A-Za-z0-9_./-]+\.json$/.test(path);
  }

  function validateManifest(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("manifest_not_object");
    if (value?.schemaVersion !== SUPPORTED_SCHEMA) errors.push("unsupported_schema_version");
    if (!/^[a-z0-9_-]+$/.test(String(value?.worldId || ""))) errors.push("invalid_world_id");
    if (!/^\d+\.\d+$/.test(String(value?.packageVersion || ""))) errors.push("invalid_package_version");
    if (!value?.source?.designArchive) errors.push("missing_design_archive");
    if (!Array.isArray(value?.runtimeFiles)) errors.push("missing_runtime_files");
    else {
      const files = value.runtimeFiles.map((item) => String(item || ""));
      if (files.some((file) => !safeRuntimePath(file))) errors.push("invalid_runtime_file");
      if (new Set(files).size !== files.length) errors.push("duplicate_runtime_file");
    }
    return { ok: errors.length === 0, errors };
  }

  function validateRulesDocument(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("rules_not_object");
    if (value?.schemaVersion !== RULES_SCHEMA) errors.push("unsupported_rules_schema");
    if (!/^[a-z0-9_-]+$/.test(String(value?.worldId || ""))) errors.push("invalid_rules_world_id");
    if (!/^\d+\.\d+$/.test(String(value?.packageVersion || ""))) errors.push("invalid_rules_package_version");
    if (!Array.isArray(value?.relationRules)) errors.push("missing_relation_rules");
    return { ok: errors.length === 0, errors };
  }

  function authoredIdOf(value) {
    const entity = Array.isArray(value?.cards) ? value.cards[0] : value;
    const id = String(entity?.authoredId || "").trim();
    return ID_PATTERN.test(id) ? id : null;
  }

  function compileRelationRule(definition, worldId) {
    if (!definition || typeof definition !== "object" || Array.isArray(definition))
      return { ok: false, reason: "rule_not_object" };

    const id = String(definition.id || "").trim();
    if (!ID_PATTERN.test(id)) return { ok: false, reason: "invalid_rule_id", id: id || null };

    const status = String(definition.status || "").trim();
    if (status !== "BOUND") return { ok: false, reason: "rule_not_executable", id };

    if (definition.type !== RULE_TYPE) return { ok: false, reason: "unsupported_rule_type", id };

    const purposes = uniqueStrings(definition.policy?.purposes);
    if (!purposes.length) return { ok: false, reason: "missing_rule_purpose", id };

    const declaredWorlds = uniqueStrings(definition.policy?.worldIds);
    if (declaredWorlds.length && !declaredWorlds.includes(worldId))
      return { ok: false, reason: "rule_world_mismatch", id };

    if (!Array.isArray(definition.pairs) || !definition.pairs.length)
      return { ok: false, reason: "missing_explicit_pairs", id };

    const pairKeys = new Set();
    for (const pair of definition.pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) return { ok: false, reason: "invalid_explicit_pair", id };
      const left = String(pair[0] || "").trim(), right = String(pair[1] || "").trim();
      if (!ID_PATTERN.test(left) || !ID_PATTERN.test(right) || /^TBD(?:_|$)/i.test(left) || /^TBD(?:_|$)/i.test(right))
        return { ok: false, reason: "invalid_explicit_pair", id };
      pairKeys.add(`${left}\u0000${right}`);
    }

    const policy = {
      ...definition.policy,
      purposes,
      worldIds: [worldId],
    };

    return {
      ok: true,
      id,
      rule: {
        id,
        policy,
        matches(left, right) {
          const leftId = authoredIdOf(left), rightId = authoredIdOf(right);
          return !!(leftId && rightId && pairKeys.has(`${leftId}\u0000${rightId}`));
        },
      },
    };
  }

  function registerRelationRules(document, engine = globalThis.relationRuleEngine) {
    const validation = validateRulesDocument(document);
    if (!validation.ok) return { ok: false, validation, registered: [], skipped: [] };
    if (!engine || typeof engine.register !== "function")
      return { ok: false, validation, registered: [], skipped: [{ id: null, reason: "relation_engine_unavailable" }] };

    const registered = [], skipped = [], existing = new Set(typeof engine.ruleIds === "function" ? engine.ruleIds() : []);
    for (const definition of document.relationRules) {
      const compiled = compileRelationRule(definition, document.worldId);
      if (!compiled.ok) {
        skipped.push({ id: compiled.id || null, reason: compiled.reason });
        continue;
      }
      if (existing.has(compiled.id)) {
        skipped.push({ id: compiled.id, reason: "already_registered" });
        continue;
      }
      try {
        engine.register(compiled.rule);
        existing.add(compiled.id);
        registered.push(compiled.id);
      } catch (error) {
        skipped.push({ id: compiled.id, reason: "registration_failed", message: String(error?.message || error) });
      }
    }
    return { ok: true, validation, registered, skipped };
  }

  async function loadManifest(worldId = "forest", version = "0.03") {
    const safeWorld = String(worldId).replace(/[^a-z0-9_-]/g, "");
    const safeVersion = String(version).replace(/[^0-9.]/g, "");
    const response = await fetch(`${ROOT}/${safeWorld}/v${safeVersion}/package.manifest.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`content_manifest_${response.status}`);
    const manifest = await response.json();
    const validation = validateManifest(manifest);
    if (!validation.ok) throw Object.assign(new Error("invalid_content_manifest"), { validation });
    if (manifest.worldId !== safeWorld || manifest.packageVersion !== safeVersion)
      throw new Error("content_manifest_identity_mismatch");
    return Object.freeze(manifest);
  }

  async function loadRuntimeFile(manifest, file) {
    const validation = validateManifest(manifest);
    if (!validation.ok) throw Object.assign(new Error("invalid_content_manifest"), { validation });
    const safeFile = String(file || "");
    if (!safeRuntimePath(safeFile) || !manifest.runtimeFiles.includes(safeFile))
      throw new Error("undeclared_runtime_file");
    const response = await fetch(`${ROOT}/${manifest.worldId}/v${manifest.packageVersion}/${safeFile}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`content_runtime_${response.status}`);
    return response.json();
  }

  async function loadRules(worldId = "forest", version = "0.03") {
    const manifest = await loadManifest(worldId, version);
    if (!manifest.runtimeFiles.includes(RULES_FILE)) throw new Error("rules_runtime_file_not_declared");
    const document = await loadRuntimeFile(manifest, RULES_FILE);
    const validation = validateRulesDocument(document);
    if (!validation.ok) throw Object.assign(new Error("invalid_relation_rules"), { validation });
    if (document.worldId !== manifest.worldId || document.packageVersion !== manifest.packageVersion)
      throw new Error("relation_rules_identity_mismatch");
    return Object.freeze({ manifest, document });
  }

  async function loadAndRegisterRelations(worldId = "forest", version = "0.03", engine = globalThis.relationRuleEngine) {
    const { manifest, document } = await loadRules(worldId, version);
    return Object.freeze({ manifest, document, report: registerRelationRules(document, engine) });
  }

  globalThis.SolivocWorldContent = Object.freeze({
    loadManifest,
    loadRuntimeFile,
    loadRules,
    loadAndRegisterRelations,
    registerRelationRules,
    compileRelationRule,
    validateManifest,
    validateRulesDocument,
    supportedSchema: SUPPORTED_SCHEMA,
    supportedRulesSchema: RULES_SCHEMA,
    rulesFile: RULES_FILE,
  });
})();
