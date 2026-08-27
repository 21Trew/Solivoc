/* Explainable deterministic encounter routing. No RNG, no global friendship score. */
(() => {
  const CONTRACT_VERSION = "forest-routing@1";
  const DEFAULT_FACTOR_ORDER = Object.freeze([
    "STAGE_FIT",
    "THREAD_CONTINUITY",
    "SCENE_FIT",
    "PLAYER_COMPLEMENTARITY",
    "PLAYER_INITIATIVE",
    "UNRESOLVED_MUTUAL_CONTRADICTION",
    "RECIPROCAL_HISTORY_DEPTH",
    "COOPERATION_TRANSFER",
    "TEMPORARY_ALLIANCE_COMPLETED",
    "FRESH_VOLUNTARY_PLAYER_CONTINUATION",
  ]);

  function array(value) { return Array.isArray(value) ? value : []; }
  function bool(value) { return value === true; }
  function relationship(snapshot, characterId) { return snapshot?.relationships?.[characterId] || {}; }
  function thread(snapshot, characterId) { return snapshot?.threads?.[characterId] || snapshot?.threads?.[`THREAD_FOREST_${String(characterId || "").toUpperCase()}`] || {}; }

  function relationshipStateSatisfied(key, snapshot) {
    const fox = relationship(snapshot, "fox");
    if (key === "fox_not_acquainted") return fox.acquainted !== true;
    if (key === "fox_acquainted") return fox.acquainted === true;
    if (key === "fox_encountered") return fox.identityKnown === true || fox.identity_known === true || fox.acquainted === true;
    return array(snapshot?.relationshipStates).includes(key);
  }

  function participantEligible(characterId, encounter, snapshot) {
    const rel = relationship(snapshot, characterId);
    const hard = encounter?.participantHardRequirements || {};
    if (hard.identityKnown === true && !(rel.identityKnown === true || rel.identity_known === true)) return false;
    if (hard.acquainted === true && rel.acquainted !== true) return false;
    if (hard.narrativeCompatibility === true && rel.narrativeCompatibility !== true && rel.narrative_compatibility !== true) return false;
    for (const milestone of array(hard.milestones)) {
      if (rel?.milestones?.[milestone] !== true && rel?.[milestone] !== true) return false;
    }
    return true;
  }

  function variantEligible(variant, encounter, snapshot = {}, sceneSignals = []) {
    if (!variant || !variant.id || !array(variant.participants).length) return false;
    if (variant.requiresSceneSignal && !sceneSignals.includes(variant.requiresSceneSignal)) return false;
    if (variant.requiresRelationshipState && !relationshipStateSatisfied(variant.requiresRelationshipState, snapshot)) return false;
    if (variant.validEntryModes?.length) {
      const modes = array(snapshot?.entryModes);
      if (!variant.validEntryModes.some((mode) => modes.includes(mode))) return false;
    }
    return variant.participants.every((characterId) => participantEligible(characterId, encounter, snapshot));
  }

  function factorApplies(factor, variant, snapshot = {}, sceneSignals = []) {
    const participants = array(variant?.participants);
    if (factor === "SCENE_FIT") return bool(snapshot?.variantEvidence?.[variant.id]?.sceneFit) || sceneSignals.includes(`variant:${variant.id}`);
    if (factor === "STAGE_FIT") return bool(snapshot?.variantEvidence?.[variant.id]?.stageFit);
    if (factor === "PLAYER_COMPLEMENTARITY") return bool(snapshot?.variantEvidence?.[variant.id]?.playerComplementarity);
    if (factor === "UNRESOLVED_MUTUAL_CONTRADICTION") return bool(snapshot?.variantEvidence?.[variant.id]?.unresolvedMutualContradiction);
    if (factor === "COOPERATION_TRANSFER") return bool(snapshot?.variantEvidence?.[variant.id]?.cooperationTransfer);
    if (factor === "THREAD_CONTINUITY") return participants.some((id) => bool(thread(snapshot, id)?.unfinishedQuestion) || bool(thread(snapshot, id)?.active));
    if (factor === "PLAYER_INITIATIVE" || factor === "FRESH_VOLUNTARY_PLAYER_CONTINUATION") return participants.some((id) => bool(thread(snapshot, id)?.freshVoluntaryContinuation));
    if (factor === "TEMPORARY_ALLIANCE_COMPLETED") return participants.some((id) => bool(relationship(snapshot, id)?.milestones?.temporary_alliance_completed) || bool(relationship(snapshot, id)?.temporaryAllianceCompleted));
    if (factor === "RECIPROCAL_HISTORY_DEPTH") return participants.some((id) => Number(relationship(snapshot, id)?.meaningfulRelationshipEvents || 0) >= 2);
    return false;
  }

  function repetitionCost(variant, snapshot = {}) {
    const recent = array(snapshot?.recentEncounterParticipants);
    return array(variant?.participants).reduce((cost, id) => cost + recent.filter((seen) => seen === id).length, 0);
  }

  function compareByFactor(a, b, factor, snapshot, sceneSignals) {
    const av = factorApplies(factor, a, snapshot, sceneSignals);
    const bv = factorApplies(factor, b, snapshot, sceneSignals);
    if (av === bv) return 0;
    return av ? -1 : 1;
  }

  function deterministicCharacterOrder(variant, encounter) {
    const order = array(encounter?.deterministicCharacterOrder);
    if (!order.length) return Number.MAX_SAFE_INTEGER;
    return Math.min(...array(variant.participants).map((id) => {
      const index = order.indexOf(id);
      return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
    }));
  }

  function rankVariants(variants, encounter, snapshot = {}, sceneSignals = []) {
    const factors = array(encounter?.authoredTieBreakOrder).filter((factor) => factor !== "DETERMINISTIC_CHARACTER_ORDER");
    const factorOrder = factors.length ? factors : DEFAULT_FACTOR_ORDER;
    const authoredIndex = new Map(array(encounter?.variants).map((variant, index) => [variant.id, index]));
    return [...variants].sort((a, b) => {
      for (const factor of factorOrder) {
        const result = compareByFactor(a, b, factor, snapshot, sceneSignals);
        if (result) return result;
      }
      const repetition = repetitionCost(a, snapshot) - repetitionCost(b, snapshot);
      if (repetition) return repetition;
      const characterOrder = deterministicCharacterOrder(a, encounter) - deterministicCharacterOrder(b, encounter);
      if (characterOrder) return characterOrder;
      return (authoredIndex.get(a.id) ?? 999) - (authoredIndex.get(b.id) ?? 999);
    });
  }

  function diagnosticReasons(variant, encounter, snapshot, sceneSignals, deadline) {
    const factors = array(encounter?.authoredTieBreakOrder).length ? encounter.authoredTieBreakOrder : DEFAULT_FACTOR_ORDER;
    const reasons = factors.filter((factor) => factor !== "DETERMINISTIC_CHARACTER_ORDER" && factorApplies(factor, variant, snapshot, sceneSignals));
    if (deadline) reasons.push("WINDOW_DEADLINE");
    if (!reasons.length) reasons.push("DETERMINISTIC_AUTHORED_ORDER");
    return [...new Set(reasons)];
  }

  function routeEncounter({ encounter, level, snapshot = {}, sceneSignals = [], completedEncounterIds = [] } = {}) {
    if (!encounter?.id || !Array.isArray(encounter.window) || encounter.window.length !== 2) return { status: "invalid-definition", encounterId: encounter?.id || null };
    const [start, end] = encounter.window.map(Number);
    const currentLevel = Number(level);
    if (!Number.isInteger(currentLevel) || currentLevel < start || currentLevel > end) return { status: "outside-window", encounterId: encounter.id };
    if (completedEncounterIds.includes(encounter.id)) return { status: "already-completed", encounterId: encounter.id };

    const deadline = currentLevel === end;
    const eligible = array(encounter.variants).filter((variant) => variantEligible(variant, encounter, snapshot, sceneSignals));
    const ranked = rankVariants(eligible, encounter, snapshot, sceneSignals);
    if (!ranked.length) {
      if (deadline && encounter.deadlinePolicy === "error-if-none") return { status: "p0-no-eligible-variant", encounterId: encounter.id, level: currentLevel, eligibleVariants: [] };
      return { status: deadline ? "deadline-unresolved" : "defer", encounterId: encounter.id, level: currentLevel, eligibleVariants: [] };
    }

    const preferred = ranked[0];
    const hasMeaningfulEvidence = diagnosticReasons(preferred, encounter, snapshot, sceneSignals, false).some((reason) => reason !== "DETERMINISTIC_AUTHORED_ORDER");
    if (!deadline && encounter.selectionMode === "evidence-gated" && !hasMeaningfulEvidence) {
      return { status: "defer", encounterId: encounter.id, level: currentLevel, eligibleVariants: ranked.map((variant) => variant.id) };
    }

    return Object.freeze({
      status: "selected",
      encounterId: encounter.id,
      level: currentLevel,
      selectedVariant: preferred.id,
      participants: Object.freeze([...preferred.participants]),
      eligibleVariants: Object.freeze(ranked.map((variant) => variant.id)),
      reasons: Object.freeze(diagnosticReasons(preferred, encounter, snapshot, sceneSignals, deadline)),
      routingContractVersion: CONTRACT_VERSION,
      deadline,
    });
  }

  function routeForLevel({ definitions, level, snapshot = {}, sceneSignals = [], completedEncounterIds = [] } = {}) {
    const encounters = array(definitions?.encounters).filter((encounter) => {
      const [start, end] = array(encounter.window).map(Number);
      return Number(level) >= start && Number(level) <= end;
    });
    for (const encounter of encounters) {
      const result = routeEncounter({ encounter, level, snapshot, sceneSignals, completedEncounterIds });
      if (!["outside-window", "already-completed"].includes(result.status)) return result;
    }
    return { status: "no-window", level: Number(level) };
  }

  globalThis.SolivocStoryEncounterRouting = Object.freeze({
    contractVersion: CONTRACT_VERSION,
    variantEligible,
    rankVariants,
    routeEncounter,
    routeForLevel,
  });
})();
