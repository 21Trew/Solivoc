/* Explainable deterministic encounter routing. No RNG, no global friendship score. */
(() => {
  const CONTRACT_VERSION = "forest-routing@1";
  const GENERIC_EVIDENCE_FACTORS = Object.freeze([
    "STAGE_FIT",
    "THREAD_CONTINUITY",
    "SCENE_FIT",
    "PLAYER_COMPLEMENTARITY",
    "PLAYER_INITIATIVE",
    "UNRESOLVED_MUTUAL_CONTRADICTION",
    "COOPERATION_TRANSFER",
    "TEMPORARY_ALLIANCE_COMPLETED",
    "FRESH_VOLUNTARY_PLAYER_CONTINUATION",
  ]);

  function array(value) { return Array.isArray(value) ? value : []; }
  function bool(value) { return value === true; }
  function relationship(snapshot, characterId) { return snapshot?.relationships?.[characterId] || {}; }
  function thread(snapshot, characterId) { return snapshot?.threads?.[characterId] || snapshot?.threads?.[`THREAD_FOREST_${String(characterId || "").toUpperCase()}`] || {}; }
  function mergeHardRequirements(base = {}, extra = {}) {
    return {
      identityKnown: base.identityKnown === true || extra.identityKnown === true,
      acquainted: base.acquainted === true || extra.acquainted === true,
      narrativeCompatibility: base.narrativeCompatibility === true || extra.narrativeCompatibility === true,
      milestones: [...new Set([...array(base.milestones), ...array(extra.milestones)])],
      minMeaningfulRelationshipEvents: Math.max(Number(base.minMeaningfulRelationshipEvents) || 0, Number(extra.minMeaningfulRelationshipEvents) || 0),
    };
  }

  function relationshipStateSatisfied(key, snapshot) {
    const fox = relationship(snapshot, "fox");
    if (key === "fox_not_acquainted") return fox.acquainted !== true;
    if (key === "fox_acquainted") return fox.acquainted === true;
    if (key === "fox_encountered") return fox.identityKnown === true || fox.identity_known === true || fox.acquainted === true;
    return array(snapshot?.relationshipStates).includes(key);
  }

  function hardRequirementsSatisfied(characterId, hard, snapshot) {
    const rel = relationship(snapshot, characterId);
    if (hard.identityKnown === true && !(rel.identityKnown === true || rel.identity_known === true)) return false;
    if (hard.acquainted === true && rel.acquainted !== true) return false;
    if (hard.narrativeCompatibility === true && rel.narrativeCompatibility !== true && rel.narrative_compatibility !== true) return false;
    if (Number(rel.meaningfulRelationshipEvents || 0) < Number(hard.minMeaningfulRelationshipEvents || 0)) return false;
    for (const milestone of array(hard.milestones)) {
      if (rel?.milestones?.[milestone] !== true && rel?.[milestone] !== true) return false;
    }
    return true;
  }

  function encounter9TransferEligible(characterId, variant, encounter, snapshot) {
    const policy = encounter?.transferEligibility;
    if (!policy) return true;
    const rel = relationship(snapshot, characterId);
    const continuityMilestone = policy.continuityMilestone;
    if (continuityMilestone && (rel?.milestones?.[continuityMilestone] === true || rel?.[continuityMilestone] === true)) return true;
    const hard = mergeHardRequirements({}, policy.switchRequirements || {});
    if (!hardRequirementsSatisfied(characterId, hard, snapshot)) return false;
    const evidenceKey = String(policy?.switchRequirements?.requiresVariantEvidence || "");
    if (evidenceKey && snapshot?.variantEvidence?.[variant.id]?.[evidenceKey] !== true) return false;
    return true;
  }

  function participantEligible(characterId, encounter, snapshot, variant = null) {
    const hard = mergeHardRequirements(encounter?.participantHardRequirements || {}, variant?.participantHardRequirements || {});
    if (!hardRequirementsSatisfied(characterId, hard, snapshot)) return false;
    return encounter9TransferEligible(characterId, variant, encounter, snapshot);
  }

  function variantEligible(variant, encounter, snapshot = {}, sceneSignals = []) {
    if (!variant || !variant.id || !array(variant.participants).length) return false;
    if (variant.requiresSceneSignal && !sceneSignals.includes(variant.requiresSceneSignal)) return false;
    if (variant.requiresRelationshipState && !relationshipStateSatisfied(variant.requiresRelationshipState, snapshot)) return false;
    if (variant.validEntryModes?.length) {
      const modes = array(snapshot?.entryModes);
      if (!variant.validEntryModes.some((mode) => modes.includes(mode))) return false;
    }
    return variant.participants.every((characterId) => participantEligible(characterId, encounter, snapshot, variant));
  }

  function factorValue(factor, variant, snapshot = {}, sceneSignals = []) {
    const participants = array(variant?.participants);
    if (factor === "SCENE_FIT") return bool(snapshot?.variantEvidence?.[variant.id]?.sceneFit) || sceneSignals.includes(`variant:${variant.id}`) ? 1 : 0;
    if (factor === "STAGE_FIT") return bool(snapshot?.variantEvidence?.[variant.id]?.stageFit) ? 1 : 0;
    if (factor === "PLAYER_COMPLEMENTARITY") return bool(snapshot?.variantEvidence?.[variant.id]?.playerComplementarity) ? 1 : 0;
    if (factor === "UNRESOLVED_MUTUAL_CONTRADICTION") return bool(snapshot?.variantEvidence?.[variant.id]?.unresolvedMutualContradiction) ? 1 : 0;
    if (factor === "COOPERATION_TRANSFER") return bool(snapshot?.variantEvidence?.[variant.id]?.cooperationTransfer) ? 1 : 0;
    if (factor === "THREAD_CONTINUITY") return participants.some((id) => bool(thread(snapshot, id)?.unfinishedQuestion)) ? 1 : 0;
    if (factor === "PLAYER_INITIATIVE" || factor === "FRESH_VOLUNTARY_PLAYER_CONTINUATION") return participants.some((id) => bool(thread(snapshot, id)?.freshVoluntaryContinuation)) ? 1 : 0;
    if (factor === "TEMPORARY_ALLIANCE_COMPLETED") return participants.some((id) => bool(relationship(snapshot, id)?.milestones?.temporary_alliance_completed) || bool(relationship(snapshot, id)?.temporaryAllianceCompleted)) ? 1 : 0;
    if (factor === "RECIPROCAL_HISTORY_DEPTH") return Math.max(0, ...participants.map((id) => Number(relationship(snapshot, id)?.meaningfulRelationshipEvents || 0)));
    return 0;
  }

  function compareByFactor(a, b, factor, snapshot, sceneSignals) {
    const av = factorValue(factor, a, snapshot, sceneSignals);
    const bv = factorValue(factor, b, snapshot, sceneSignals);
    if (av === bv) return 0;
    return av > bv ? -1 : 1;
  }

  function deterministicCharacterOrder(variant, encounter) {
    const order = array(encounter?.deterministicCharacterOrder);
    if (!order.length) return Number.MAX_SAFE_INTEGER;
    return Math.min(...array(variant.participants).map((id) => {
      const index = order.indexOf(id);
      return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
    }));
  }

  function authoredIndex(encounter) {
    return new Map(array(encounter?.variants).map((variant, index) => [variant.id, index]));
  }

  function rankVariants(variants, encounter, snapshot = {}, sceneSignals = []) {
    const index = authoredIndex(encounter);
    const factors = array(encounter?.authoredTieBreakOrder);
    if (!factors.length) return [...variants].sort((a, b) => (index.get(a.id) ?? 999) - (index.get(b.id) ?? 999));
    return [...variants].sort((a, b) => {
      for (const factor of factors) {
        if (factor === "DETERMINISTIC_CHARACTER_ORDER") {
          const result = deterministicCharacterOrder(a, encounter) - deterministicCharacterOrder(b, encounter);
          if (result) return result;
          continue;
        }
        const result = compareByFactor(a, b, factor, snapshot, sceneSignals);
        if (result) return result;
      }
      return (index.get(a.id) ?? 999) - (index.get(b.id) ?? 999);
    });
  }

  function genericEvidenceReasons(variant, snapshot, sceneSignals) {
    const reasons = [];
    if (variant.requiresSceneSignal && sceneSignals.includes(variant.requiresSceneSignal)) reasons.push("AUTHORED_SCENE_SIGNAL");
    if (array(variant.validEntryModes).some((mode) => array(snapshot?.entryModes).includes(mode))) reasons.push("AUTHORED_ENTRY_MODE");
    for (const factor of GENERIC_EVIDENCE_FACTORS) if (factorValue(factor, variant, snapshot, sceneSignals) > 0) reasons.push(factor);
    return [...new Set(reasons)];
  }

  function authoredRankingReasons(preferred, ranked, encounter, snapshot, sceneSignals) {
    const reasons = [];
    for (const factor of array(encounter?.authoredTieBreakOrder)) {
      if (factor === "DETERMINISTIC_CHARACTER_ORDER") break;
      const value = factorValue(factor, preferred, snapshot, sceneSignals);
      const otherValues = ranked.filter((variant) => variant.id !== preferred.id).map((variant) => factorValue(factor, variant, snapshot, sceneSignals));
      if (otherValues.some((other) => value > other)) reasons.push(factor);
    }
    return reasons;
  }

  function hasAuthoredDistinction(ranked, encounter, snapshot, sceneSignals) {
    if (ranked.length <= 1) return true;
    const [first, second] = ranked;
    for (const factor of array(encounter?.authoredTieBreakOrder)) {
      if (factor === "DETERMINISTIC_CHARACTER_ORDER") break;
      if (factorValue(factor, first, snapshot, sceneSignals) !== factorValue(factor, second, snapshot, sceneSignals)) return true;
    }
    return false;
  }

  function selectionDeadline(encounter, currentLevel, end) {
    return currentLevel === end || Number(encounter?.requiredStartLevel) === currentLevel;
  }

  function selectedResult(encounter, currentLevel, preferred, eligible, reasons, deadline) {
    return Object.freeze({
      status: "selected",
      encounterId: encounter.id,
      level: currentLevel,
      selectedVariant: preferred.id,
      participants: Object.freeze([...preferred.participants]),
      eligibleVariants: Object.freeze(eligible.map((variant) => variant.id)),
      reasons: Object.freeze([...new Set(reasons)]),
      routingContractVersion: CONTRACT_VERSION,
      deadline,
    });
  }

  function routeEncounter({ encounter, level, snapshot = {}, sceneSignals = [], completedEncounterIds = [] } = {}) {
    if (!encounter?.id || !Array.isArray(encounter.window) || encounter.window.length !== 2) return { status: "invalid-definition", encounterId: encounter?.id || null };
    const [start, end] = encounter.window.map(Number);
    const currentLevel = Number(level);
    if (!Number.isInteger(currentLevel) || currentLevel < start || currentLevel > end) return { status: "outside-window", encounterId: encounter.id };
    if (completedEncounterIds.includes(encounter.id)) return { status: "already-completed", encounterId: encounter.id };

    const deadline = selectionDeadline(encounter, currentLevel, end);
    const eligible = array(encounter.variants).filter((variant) => variantEligible(variant, encounter, snapshot, sceneSignals));
    if (!eligible.length) {
      if (deadline && encounter.deadlinePolicy === "error-if-none") return { status: "p0-no-eligible-variant", encounterId: encounter.id, level: currentLevel, eligibleVariants: [] };
      return { status: deadline ? "deadline-unresolved" : "defer", encounterId: encounter.id, level: currentLevel, eligibleVariants: [] };
    }

    if (encounter.selectionMode === "fixed-authored") {
      const preferred = eligible[0];
      return selectedResult(encounter, currentLevel, preferred, eligible, ["FIXED_AUTHORED", ...(deadline ? ["WINDOW_DEADLINE"] : [])], deadline);
    }

    if (array(encounter.authoredTieBreakOrder).length) {
      const ranked = rankVariants(eligible, encounter, snapshot, sceneSignals);
      const preferred = ranked[0];
      if (!deadline && !hasAuthoredDistinction(ranked, encounter, snapshot, sceneSignals)) {
        return { status: "defer", encounterId: encounter.id, level: currentLevel, eligibleVariants: ranked.map((variant) => variant.id) };
      }
      const reasons = authoredRankingReasons(preferred, ranked, encounter, snapshot, sceneSignals);
      const usedDeterministicFallback = reasons.length === 0;
      if (deadline) reasons.push(currentLevel === Number(encounter.requiredStartLevel) ? "REQUIRED_START_LEVEL" : "WINDOW_DEADLINE");
      if (usedDeterministicFallback) reasons.push("DETERMINISTIC_CHARACTER_ORDER");
      return selectedResult(encounter, currentLevel, preferred, ranked, reasons, deadline);
    }

    const ordered = rankVariants(eligible, encounter, snapshot, sceneSignals);
    if (!deadline && encounter.selectionMode === "evidence-gated") {
      if (ordered.length === 1) return selectedResult(encounter, currentLevel, ordered[0], ordered, ["SOLE_ELIGIBLE_VARIANT"], false);
      const evidenced = ordered.map((variant) => ({ variant, reasons: genericEvidenceReasons(variant, snapshot, sceneSignals) })).filter((row) => row.reasons.length);
      if (evidenced.length !== 1) return { status: "defer", encounterId: encounter.id, level: currentLevel, eligibleVariants: ordered.map((variant) => variant.id) };
      return selectedResult(encounter, currentLevel, evidenced[0].variant, ordered, evidenced[0].reasons, false);
    }

    const preferred = ordered[0];
    const reasons = genericEvidenceReasons(preferred, snapshot, sceneSignals);
    if (deadline) reasons.push(currentLevel === Number(encounter.requiredStartLevel) ? "REQUIRED_START_LEVEL" : "WINDOW_DEADLINE", "DETERMINISTIC_AUTHORED_ORDER");
    if (!reasons.length) reasons.push("DETERMINISTIC_AUTHORED_ORDER");
    return selectedResult(encounter, currentLevel, preferred, ordered, reasons, deadline);
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
