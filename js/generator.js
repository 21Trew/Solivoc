/* Seeded level generation, solver guard, chapters, special levels and tutorials. */
function chapterInfo(level = 1) {
  const number = Math.max(1, Math.floor((Math.max(1, level) - 1) / CHAPTER_SIZE) + 1),
    start = (number - 1) * CHAPTER_SIZE + 1,
    end = start + CHAPTER_SIZE - 1;
  return { number, start, end, title: CHAPTER_NAMES[number - 1] || `Глава ${number}` };
}
function chapterFinalSpecial(level) {
  if (!level || level % CHAPTER_SIZE !== 0) return null;
  const chapter = chapterInfo(level).number, cycle = (chapter - 1) % 4;
  const defs = [
    { id: "final-mystery", icon: "◆", title: "Финал: Тайные категории", desc: "Названия категорий откроются после первого найденного слова", boss: true, mysteryCategories: true },
    { id: "final-lock", icon: "◆", title: "Финал: Закрытый слот", desc: "Последний слот откроется после первой собранной категории", boss: true, lockedSlot: true, unlockAfter: 1 },
    { id: "final-precise", icon: "◆", title: "Финал: Один шанс", desc: "Без подсказок и только одна прокрутка колоды", boss: true, noHints: true, maxRecycles: 1 },
    { id: "final-mix", icon: "◆", title: "Финал: Большая смесь", desc: "Больше категорий, одна отмена и плотный расклад", boss: true, bigMix: true, maxUndos: 1 },
  ];
  return { ...defs[cycle], chapter };
}
function specialForLevel(level) {
  const final = chapterFinalSpecial(level);
  if (final) return final;
  if (!level || level < 5) return null;
  const offset = ((level - 1) % 20) + 1;
  const def = SPECIAL_LEVELS.find((x) => x.offset === offset);
  return def ? { ...def } : null;
}
const WORD_DIFFICULTY_CACHE = new Map();
function wordDifficulty(cat, word) {
  const cacheKey = `${cat?.id || ""}:${word}`;
  if (WORD_DIFFICULTY_CACHE.has(cacheKey)) return WORD_DIFFICULTY_CACHE.get(cacheKey);
  const explicit = cat?.wordDifficulty?.[word];
  if (Number.isFinite(+explicit)) {
    const score = Math.max(1, Math.min(5, +explicit));
    WORD_DIFFICULTY_CACHE.set(cacheKey, score);
    return score;
  }
  const normalized = normWord(word);
  const owners = BANK.reduce((n, c) => n + (c.words || []).some((w) => normWord(w) === normalized), 0);
  let score = word.length <= 5 ? 1 : word.length <= 7 ? 2 : word.length <= 9 ? 3 : 4;
  if (owners > 1) score += 1;
  score = Math.max(1, Math.min(5, score));
  WORD_DIFFICULTY_CACHE.set(cacheKey, score);
  return score;
}
function categoryDifficulty(cat) {
  if (Number.isFinite(+cat?.difficulty)) return Math.max(1, Math.min(5, +cat.difficulty));
  const avg = cat.words.reduce((n, w) => n + wordDifficulty(cat, w), 0) / Math.max(1, cat.words.length);
  return avg < 1.8 ? 1 : avg < 2.5 ? 2 : avg < 3.2 ? 3 : avg < 4 ? 4 : 5;
}
function chooseWordsForDifficulty(cat, count, difficulty, rng) {
  const target = Math.max(1, Math.min(5, difficulty));
  const randomized = shuffle(cat.words, rng);
  randomized.sort((a, b) => Math.abs(wordDifficulty(cat, a) - target) - Math.abs(wordDifficulty(cat, b) - target));
  const pool = randomized.slice(0, Math.max(count, Math.min(randomized.length, count + 4)));
  return shuffle(pool, rng).slice(0, count);
}
function regularConfig(level, rng, special = null) {
  let colRange;
  if (level <= 10) colRange = [3, 3];
  else if (level <= 25) colRange = [3, 4];
  else if (level <= 50) colRange = [4, 5];
  else if (level <= 100) colRange = [4, 5];
  else colRange = [3, 5];
  let cols = rnd(colRange[0], colRange[1], rng);
  const recovery = level > 5 && level % 6 === 0;
  if (recovery) cols = Math.max(3, cols - 1);
  const ranges = { 3: [3, 4], 4: [4, 6], 5: [6, 7] },
    cr = ranges[cols];
  const cats = rnd(cr[0], cr[1], rng);
  let difficulty = level <= 12 ? 1 : level <= 35 ? 2 : level <= 80 ? 3 : level <= 160 ? 4 : 5;
  if (recovery) difficulty = Math.max(1, difficulty - 1);
  let words = difficulty === 1 ? [3, 5] : difficulty === 2 ? [4, 6] : difficulty === 3 ? [4, 7] : [5, 7];
  if (special?.bigMix) {
    cols = 5;
    const mixRange = ranges[5];
    const boostedCats = Math.min(7, Math.max(cats + 1, mixRange[0] + 1));
    words = [Math.min(7, words[0] + 1), Math.min(7, words[1] + 1)];
    return { cols, cats: boostedCats, difficulty: Math.max(2, difficulty), words };
  }
  return { cols, cats, difficulty, words };
}
function configForMode(level, mode, rng, special = null, opts = {}) {
  if (mode === "daily") return { cols: 5, cats: 7, difficulty: 3, words: [4, 7] };
  if (mode === "collection") return { cols: 4, cats: 4, difficulty: 1, words: [5, 6] };
  if (mode === "challenge") {
    const cfg = regularConfig(Math.max(12, level || 25), rng, null);
    return { ...cfg, difficulty: Math.max(2, Math.min(5, cfg.difficulty)) };
  }
  if (mode === "calm") {
    const cols = rnd(3, 4, rng), ranges = { 3: [3, 4], 4: [4, 5] };
    return { cols, cats: rnd(...ranges[cols], rng), difficulty: 1, words: [3, 5] };
  }
  if (mode === "marathon") {
    const round = Math.max(1, opts.marathonRound || 1);
    return regularConfig(Math.min(180, 8 + round * 6), rng, null);
  }
  if (["time", "moves", "combo", "noMistakes", "onePass", "custom"].includes(mode)) {
    const cfg = regularConfig(Math.max(18, level || 25), rng, null);
    return { ...cfg, difficulty: Math.max(2, Math.min(4, cfg.difficulty)) };
  }
  return typeof applyAdaptiveConfig === "function" ? applyAdaptiveConfig(regularConfig(level, rng, special), special) : regularConfig(level, rng, special);
}
function sanitizeCustomRules(value = {}) {
  return {
    timeLimitSec: Math.max(0, Math.min(900, Math.round(+value.timeLimitSec || 0))),
    moveLimit: Math.max(0, Math.min(400, Math.round(+value.moveLimit || 0))),
    comboTarget: Math.max(0, Math.min(40, Math.round(+value.comboTarget || 0))),
    noMistakes: !!value.noMistakes,
    onePass: !!value.onePass,
  };
}
function modeRulesFor(mode, { cardCount = 36, totalCategories = 5 } = {}, customRules = null) {
  if (mode === "time") return { timeLimitMs: Math.max(90000, Math.min(300000, Math.round(cardCount * 4300))) };
  if (mode === "moves") return { moveLimit: Math.max(45, Math.min(180, Math.round(cardCount * 2.15))) };
  if (mode === "combo") return { comboTarget: Math.max(6, Math.min(20, totalCategories * 2)) };
  if (mode === "noMistakes") return { noMistakes: true };
  if (mode === "onePass") return { maxRecycles: 0 };
  if (mode === "custom") {
    const c=sanitizeCustomRules(customRules || profile?.customRules || {});
    return {
      ...(c.timeLimitSec ? { timeLimitMs: c.timeLimitSec * 1000 } : {}),
      ...(c.moveLimit ? { moveLimit: c.moveLimit } : {}),
      ...(c.comboTarget ? { comboTarget: c.comboTarget } : {}),
      ...(c.noMistakes ? { noMistakes: true } : {}),
      ...(c.onePass ? { maxRecycles: 0 } : {}),
    };
  }
  return {};
}

function categoryByAnyId(id) {
  if (String(id || "").startsWith("visual:")) return allAssociationCategories().find((x) => x.id === id) || null;
  return BANK.find((x) => x.id === id) || null;
}
function categoryCooldownSets(ids = []) {
  const idSet = new Set(ids.filter(Boolean));
  const titleSet = new Set();
  for (const id of idSet) {
    const cat = categoryByAnyId(id);
    if (cat?.title) titleSet.add(normWord(cat.title));
  }
  return { idSet, titleSet };
}
function chooseCompatibleFromPool(pool, count, difficulty, rng, initial = [], cooldownIds = []) {
  const { idSet, titleSet } = categoryCooldownSets(cooldownIds);
  const ordered = shuffle(pool, rng).sort(
    (a, b) => Math.abs(categoryDifficulty(a) - difficulty) - Math.abs(categoryDifficulty(b) - difficulty),
  );
  const fresh = ordered.filter((cat) => !idSet.has(cat.id) && !titleSet.has(normWord(cat.title)));
  const stale = ordered.filter((cat) => idSet.has(cat.id) || titleSet.has(normWord(cat.title)));
  const chosen = [...initial];
  const fill = (source) => {
    for (const cat of source) {
      if (chosen.some((x) => x.id === cat.id)) continue;
      if (chosen.every((c) => !categoriesConflict(cat, c))) {
        chosen.push(cat);
        if (chosen.length === count) return true;
      }
    }
    return false;
  };
  // Recent categories are a hard cooldown while there are enough compatible alternatives.
  // Only fall back to them when a heavily constrained pool would otherwise fail to generate.
  if (fill(fresh)) return chosen;
  if (fill(stale)) return chosen;
  return [];
}
function chooseCompatibleCategories(count, difficulty, rng, cooldownIds = []) {
  return chooseCompatibleFromPool(BANK, count, difficulty, rng, [], cooldownIds);
}
function chooseCollectionCategories(collectionId, desiredCount, rng) {
  const pool = shuffle(associationCollectionCategories(collectionId), rng);
  const target = Math.max(1, Math.min(desiredCount, pool.length));
  let best = [];
  const search = (index, chosen) => {
    if (chosen.length > best.length) best = [...chosen];
    if (best.length >= target || index >= pool.length) return;
    if (chosen.length + (pool.length - index) <= best.length) return;
    for (let i = index; i < pool.length; i++) {
      const cat = pool[i];
      if (chosen.every((other) => !categoriesConflict(cat, other))) search(i + 1, [...chosen, cat]);
      if (best.length >= target) return;
    }
  };
  search(0, []);
  return best.slice(0, target);
}
function categoriesForSourceMode(count, difficulty, rng, sourceMode = "all", cooldownIds = []) {
  const mode = normalizeCardSourceMode(sourceMode);
  const visuals = allAssociationCategories();
  if (mode === "words") return chooseCompatibleCategories(count, difficulty, rng, cooldownIds);
  if (mode === "pictures") return chooseCompatibleFromPool(visuals, count, 2, rng, [], cooldownIds);
  if (count <= 1) return chooseCompatibleFromPool([...BANK, ...visuals], count, difficulty, rng, [], cooldownIds);
  const visualTarget = Math.max(1, Math.min(count - 1, Math.round(count * (0.34 + rng() * 0.18))));
  const wordTarget = count - visualTarget;
  const words = chooseCompatibleFromPool(BANK, wordTarget, difficulty, rng, [], cooldownIds);
  if (words.length !== wordTarget) return chooseCompatibleFromPool([...BANK, ...visuals], count, difficulty, rng, [], cooldownIds);
  const mixed = chooseCompatibleFromPool(visuals, count, 2, rng, words, cooldownIds);
  return mixed.length === count ? shuffle(mixed, rng) : chooseCompatibleFromPool([...BANK, ...visuals], count, difficulty, rng, [], cooldownIds);
}
function randomColumnCounts(total, cols, rng, hardMax = 6) {
  total = Math.min(total, cols * hardMax);
  const counts = Array(cols).fill(1);
  let rest = Math.max(0, total - cols);
  while (rest > 0) {
    const candidates = counts.map((n, i) => (n < hardMax ? i : -1)).filter((i) => i >= 0);
    if (!candidates.length) break;
    counts[candidates[rnd(0, candidates.length - 1, rng)]]++;
    rest--;
  }
  for (let i = 0; i < cols * 5; i++) {
    const a = rnd(0, cols - 1, rng), b = rnd(0, cols - 1, rng);
    if (a !== b && counts[a] > 1 && counts[b] < hardMax && rng() < 0.75) { counts[a]--; counts[b]++; }
  }
  if (new Set(counts).size === 1 && total > cols && counts[0] > 1 && counts[cols - 1] < hardMax) { counts[0]--; counts[cols - 1]++; }
  return shuffle(counts, rng);
}
function allCards(s) {
  return [
    ...(s?.stock || []),
    ...(s?.waste || []),
    ...(s?.columns || []).flatMap((c) => (c || []).flatMap((g) => g?.cards || [])),
    ...(s?.slots || []).flatMap((g) => (g?.cards || [])),
  ];
}
function isPlayableGeneratedState(s) {
  const total = Math.floor(+s?.totalCategories || 0),
    completed = Math.floor(+s?.completed || 0),
    ids = Array.isArray(s?.categoryIds) ? s.categoryIds.filter(Boolean) : [];
  if (total < 1 || completed < 0 || completed > total || ids.length !== total || new Set(ids).size !== total) return false;
  const cards = allCards(s), counts = new Map(ids.map((id) => [id, { categories: 0, words: 0 }]));
  for (const card of cards) {
    const row = counts.get(card?.cat);
    if (!row) return false;
    if (card.type === "category") row.categories++;
    else if (card.type === "word") row.words++;
    else return false;
  }
  let active = 0;
  for (const row of counts.values()) {
    const present = row.categories > 0 || row.words > 0;
    if (!present) continue;
    active++;
    if (row.categories !== 1 || row.words < 3) return false;
  }
  // A completed category is removed from the board as one atomic group.
  // Therefore the number of absent category sets must exactly match completed.
  return total - active === completed;
}
function isLikelySolvable(s) {
  const cards = allCards(s),
    totals = {};
  for (const c of cards) if (c.type === "word") totals[c.cat] = (totals[c.cat] || 0) + 1;
  const reserve = cards.filter((c) => s.stock.some((x) => x.uid === c.uid));
  const cols = s.columns.map((col) =>
    col.map((g) => ({
      cat: g.cards[0].cat,
      type: g.cards[0].type,
      count: g.cards.filter((c) => c.type === "word").length,
    })),
  );
  const active = new Map();
  let completed = 0,
    guard = 0;
  const target = s.totalCategories;
  while (guard++ < 800 && completed < target) {
    let progress = false;
    while (active.size < s.cols) {
      const i = reserve.findIndex((c) => c.type === "category" && !active.has(c.cat));
      if (i < 0) break;
      const c = reserve.splice(i, 1)[0];
      active.set(c.cat, 0);
      progress = true;
    }
    for (let i = reserve.length - 1; i >= 0; i--) {
      const c = reserve[i];
      if (c.type === "word" && active.has(c.cat)) {
        active.set(c.cat, active.get(c.cat) + 1);
        reserve.splice(i, 1);
        progress = true;
      }
    }
    for (const col of cols) {
      if (!col.length) continue;
      const top = col[col.length - 1];
      if (top.type === "category" && active.size < s.cols && !active.has(top.cat)) {
        col.pop();
        active.set(top.cat, 0);
        progress = true;
      } else if (top.type === "word" && active.has(top.cat)) {
        col.pop();
        active.set(top.cat, active.get(top.cat) + top.count);
        progress = true;
      }
    }
    for (const [cat, n] of [...active])
      if (n >= totals[cat]) {
        active.delete(cat);
        completed++;
        progress = true;
      }
    if (completed >= target) return true;
    if (progress) continue;
    let merged = false;
    for (let a = 0; a < cols.length && !merged; a++) {
      if (!cols[a].length) continue;
      const ta = cols[a][cols[a].length - 1];
      if (ta.type !== "word") continue;
      for (let b = 0; b < cols.length; b++) {
        if (a === b || !cols[b].length) continue;
        const tb = cols[b][cols[b].length - 1];
        if (tb.type === "word" && ta.cat === tb.cat) {
          tb.count += ta.count;
          cols[a].pop();
          merged = progress = true;
          break;
        }
      }
    }
    if (merged) continue;
    const empty = cols.findIndex((c) => !c.length);
    if (empty >= 0) {
      const source = cols.findIndex((c) => c.length > 1 && c[c.length - 1].type === "word");
      if (source >= 0) {
        cols[empty].push(cols[source].pop());
        progress = true;
      }
    }
    if (!progress) break;
  }
  return completed === target;
}
function imperfectDealChance(cfg, mode = "regular") {
  if (mode !== "regular") return 0;
  const difficulty = Math.max(1, Math.min(5, +(cfg?.difficulty || 1)));
  const games = Math.max(0, +(profile?.stats?.gamesPlayed || 0));
  const difficultyFactor = (difficulty - 1) / 4;
  const experienceFactor = Math.min(1, games / 300);
  return Math.min(0.08, 0.02 + 0.035 * difficultyFactor + 0.025 * experienceFactor);
}
function riskDealRoll(seed, cfg, mode, forceSolvable = false) {
  if (forceSolvable || mode !== "regular") return { risk: false, chance: 0 };
  const chance = imperfectDealChance(cfg, mode);
  const rng = makeRng(`${seed}:natural-risk`);
  return { risk: rng() < chance, chance };
}

function buildGeneratedLevel(level, { mode = "regular", seed = null, challengeCode = null, challengeRole = null, challengeCreatorName = null, challengeCreatorAvatar = null, challengeCreatorResult = null, challengeGuestToken = null, duelMode = "classic", duelModeChoice = "creator", seriesId = null, seriesRound = 1, seriesScoreCreator = 0, seriesScoreGuest = 0, marathonRound = 1, marathonId = null, collectionId = null, cardSourceMode = null, categoryCooldownIds = null, forceSolvable = false, customRules = null } = {}) {
  const baseSeed = seed || (mode === "daily" ? `daily:${todayKey()}` : mode === "collection" ? `collection:${collectionId || "animals"}:${Date.now()}` : `level:${level}`);
  const sourceMode = mode === "collection" ? "pictures" : normalizeCardSourceMode(cardSourceMode || profile?.settings?.cardSourceMode);
  const cooldownIds = mode === "regular" ? (Array.isArray(categoryCooldownIds) ? [...categoryCooldownIds] : getRecentCategories().slice(0, 40)) : [];
  for (let attempt = 0; attempt < 45; attempt++) {
    const rng = makeRng(baseSeed + ":" + attempt);
    const special = mode === "regular" ? specialForLevel(level) : null,
      cfg = configForMode(level, mode, rng, special, { marathonRound }),
      riskRoll = riskDealRoll(baseSeed, cfg, mode, forceSolvable);
    const chosen = mode === "collection"
      ? chooseCollectionCategories(collectionId, cfg.cats, rng)
      : categoriesForSourceMode(cfg.cats, cfg.difficulty, rng, sourceMode, cooldownIds);
    const minimumCategories = mode === "collection" ? Math.min(3, associationCollectionCategories(collectionId).length) : cfg.cats;
    if (chosen.length < minimumCategories) continue;
    const cards = [];
    for (const cat of chosen) {
      const maxN = Math.min(cfg.words[1], 7, cat.words.length),
        minN = Math.min(cfg.words[0], maxN),
        n = rnd(minN, maxN, rng),
        words = cat.visual ? shuffle(cat.words, rng).slice(0, n) : chooseWordsForDifficulty(cat, n, cfg.difficulty, rng);
      cards.push({ uid: uid(), cat: cat.id, label: cat.title, type: "category", total: n, visualCollection: cat.visual ? (cat.visualCollection || collectionId || null) : null });
      for (const w of words) cards.push({ uid: uid(), cat: cat.id, label: w, type: "word", total: n, visual: !!cat.visual, visualAlt: cat.visualLabels?.[w] || "" });
    }
    const deck = shuffle(cards, rng),
      layoutCount = Math.min(Math.floor(deck.length / 2), cfg.cols * 6),
      layoutCards = deck.splice(0, layoutCount),
      counts = randomColumnCounts(layoutCount, cfg.cols, rng),
      columns = [];
    let cursor = 0;
    for (const count of counts) {
      const chunk = layoutCards.slice(cursor, cursor + count);
      cursor += count;
      columns.push(chunk.map((card, i) => ({ cards: [card], faceUp: i === count - 1 })));
    }
    const candidate = {
      level,
      mode,
      seed: baseSeed,
      cols: cfg.cols,
      columns,
      stock: deck,
      waste: [],
      slots: Array(cfg.cols).fill(null),
      completed: 0,
      totalCategories: chosen.length,
      categoryIds: chosen.map((c) => c.id),
      categoryCooldownIds: cooldownIds,
      collectionId: mode === "collection" ? associationCollectionById(collectionId).id : null,
      cardSourceMode: sourceMode,
      run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, maxCombo: 0, startedAt: Date.now(), pausedAt: 0, pausedDurationMs: 0 },
      special,
      challengeCode,
      challengeRole,
      challengeCreatorName,
      challengeCreatorAvatar,
      challengeCreatorResult,
      challengeGuestToken,
      duelMode: mode === "challenge" ? normalizeDuelMode(duelMode) : null,
      duelModeChoice: mode === "challenge" ? duelModeChoice : null,
      seriesId,
      seriesRound,
      seriesScoreCreator,
      seriesScoreGuest,
      marathonRound: mode === "marathon" ? marathonRound : null,
      marathonId: mode === "marathon" ? marathonId || seed : null,
      customRules: mode === "custom" ? sanitizeCustomRules(customRules || profile?.customRules || {}) : null,
      rules: modeRulesFor(mode, { cardCount: cards.length, totalCategories: chosen.length }, customRules),
      rewarded: false,
      generationAttempt: attempt,
      riskDeal: !!riskRoll.risk,
      riskDealChance: Math.round(riskRoll.chance * 1000) / 10,
    };
    if (!isPlayableGeneratedState(candidate)) continue;
    if (riskRoll.risk || isLikelySolvable(candidate)) return candidate;
  }
  console.warn("Solver fallback: используем последний корректно сформированный расклад");
  const rng = makeRng(baseSeed + ":fallback"),
    special = mode === "regular" ? specialForLevel(level) : null,
    cfg = configForMode(level, mode, rng, special, { marathonRound }),
    compatibleFallback = mode === "collection"
      ? chooseCollectionCategories(collectionId, cfg.cats, rng)
      : categoriesForSourceMode(cfg.cats, cfg.difficulty, rng, sourceMode, cooldownIds),
    rawFallbackPool = mode === "collection" ? associationCollectionCategories(collectionId) : [...BANK, ...allAssociationCategories()],
    chosen = compatibleFallback.length
      ? compatibleFallback
      : shuffle(rawFallbackPool, rng).slice(0, Math.max(1, Math.min(cfg.cats, rawFallbackPool.length))),
    cards = [];
  for (const cat of chosen) {
    const n = Math.min(mode === "collection" ? 5 : 4, cat.words.length),
      words = cat.visual ? shuffle(cat.words, rng).slice(0, n) : chooseWordsForDifficulty(cat, n, cfg.difficulty, rng);
    cards.push({ uid: uid(), cat: cat.id, label: cat.title, type: "category", total: n, visualCollection: cat.visual ? (cat.visualCollection || collectionId || null) : null });
    for (const w of words) cards.push({ uid: uid(), cat: cat.id, label: w, type: "word", total: n, visual: !!cat.visual, visualAlt: cat.visualLabels?.[w] || "" });
  }
  const cats = cards.filter((c) => c.type === "category"),
    words = cards.filter((c) => c.type === "word"),
    stock = shuffle([...cats, ...words.slice(Math.floor(words.length / 2))], rng),
    layout = shuffle(words.slice(0, Math.min(Math.floor(words.length / 2), cfg.cols * 6)), rng),
    counts = randomColumnCounts(layout.length, cfg.cols, rng);
  let k = 0;
  const fallbackState = {
    level,
    mode,
    seed: baseSeed,
    cols: cfg.cols,
    columns: counts.map((n) =>
      layout.slice(k, (k += n)).map((card, i, a) => ({ cards: [card], faceUp: i === a.length - 1 })),
    ),
    stock,
    waste: [],
    slots: Array(cfg.cols).fill(null),
    completed: 0,
    totalCategories: chosen.length,
    categoryIds: chosen.map((c) => c.id),
    categoryCooldownIds: cooldownIds,
    collectionId: mode === "collection" ? associationCollectionById(collectionId).id : null,
    cardSourceMode: sourceMode,
    run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, maxCombo: 0, startedAt: Date.now(), pausedAt: 0, pausedDurationMs: 0 },
    special,
    challengeCode,
    challengeRole,
    challengeCreatorName,
    challengeCreatorAvatar,
    challengeCreatorResult,
    challengeGuestToken,
    duelMode: mode === "challenge" ? normalizeDuelMode(duelMode) : null,
    duelModeChoice: mode === "challenge" ? duelModeChoice : null,
    seriesId,
    seriesRound,
    seriesScoreCreator,
    seriesScoreGuest,
    marathonRound: mode === "marathon" ? marathonRound : null,
    marathonId: mode === "marathon" ? marathonId || seed : null,
    customRules: mode === "custom" ? sanitizeCustomRules(customRules || profile?.customRules || {}) : null,
    rules: modeRulesFor(mode, { cardCount: cards.length, totalCategories: chosen.length }, customRules),
    rewarded: false,
    generationAttempt: "fallback",
    riskDeal: false,
    riskDealChance: 0,
  };
  if (!isPlayableGeneratedState(fallbackState)) {
    throw new Error(`Не удалось создать игровой расклад: ${mode}/${collectionId || "default"}`);
  }
  return fallbackState;
}
function findCat(title) {
  return BANK.find((c) => c.title === title) || BANK[0];
}
function makeTutorial(step = 1) {
  const titles = ["Фрукты", "Море", "Небо"],
    cat = findCat(titles[step - 1]),
    words = cat.words.slice(0, 3),
    cards = words.map((w) => ({ uid: uid(), cat: cat.id, label: w, type: "word", total: 3 })),
    cc = { uid: uid(), cat: cat.id, label: cat.title, type: "category", total: 3 };
  let columns,
    stock,
    slots = Array(3).fill(null);
  if (step === 1) {
    columns = [
      [{ cards: [cc], faceUp: true }],
      [{ cards: [cards[0]], faceUp: true }],
      [{ cards: [cards[1]], faceUp: true }],
    ];
    stock = [cards[2]];
  } else if (step === 2) {
    slots[1] = { cards: [cc], faceUp: true };
    columns = [
      [{ cards: [cards[0]], faceUp: true }],
      [{ cards: [cards[1]], faceUp: true }],
      [{ cards: [cards[2]], faceUp: true }],
    ];
    stock = [];
  } else {
    slots[1] = { cards: [cc], faceUp: true };
    columns = [[], [], []];
    stock = [...cards].reverse();
  }
  return {
    level: step,
    mode: "tutorial",
    tutorialStep: step,
    seed: `tutorial:${step}`,
    cols: 3,
    columns,
    stock,
    waste: [],
    slots,
    completed: 0,
    totalCategories: 1,
    categoryIds: [cat.id],
    run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, maxCombo: 0, startedAt: Date.now(), pausedAt: 0, pausedDurationMs: 0 },
    special: null,
    rewarded: false,
  };
}
function normalizeState(s) {
  s.run = { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, maxCombo: 0, startedAt: Date.now(), pausedAt: 0, pausedDurationMs: 0, ...(s.run || {}) };
  s.mode = s.mode || "regular";
  s.seed = s.seed || `legacy:${s.level || 1}`;
  s.rewarded = !!s.rewarded;
  s.cardSourceMode = normalizeCardSourceMode(s.cardSourceMode || (s.mode === "collection" ? "pictures" : profile?.settings?.cardSourceMode));
  return s;
}
function normalizeLoadedLayout(s) {
  const normalized = normalizeState(s);
  const allowedModes = ["daily", "collection", "marathon", "calm", "challenge", "time", "moves", "combo", "noMistakes", "onePass", "custom"];
  const rebuild = (repairInvalid = false) => {
    const mode = allowedModes.includes(normalized.mode) ? normalized.mode : "regular";
    const rebuilt = buildGeneratedLevel(normalized.level || 1, {
      mode, seed: normalized.seed, collectionId: normalized.collectionId, cardSourceMode: normalized.cardSourceMode,
      marathonRound: normalized.marathonRound, marathonId: normalized.marathonId, challengeCode: normalized.challengeCode,
      challengeRole: normalized.challengeRole, challengeCreatorName: normalized.challengeCreatorName, challengeCreatorAvatar: normalized.challengeCreatorAvatar,
      challengeCreatorResult: normalized.challengeCreatorResult, challengeGuestToken: normalized.challengeGuestToken, duelMode: normalized.duelMode, duelModeChoice: normalized.duelModeChoice,
      customRules: normalized.customRules || null, forceSolvable: true,
    });
    return { state: rebuilt, migrated: true, repairedInvalidState: repairInvalid };
  };
  if (normalized.mode !== "tutorial" && !isPlayableGeneratedState(normalized)) return rebuild(true);
  if ((normalized.cols || normalized.columns?.length || 0) <= 5) return { state: normalized, migrated: false };
  return rebuild(false);
}
