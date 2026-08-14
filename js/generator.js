/* Seeded level generation, solver guard, chapters, special levels and tutorials. */
function chapterInfo(level = 1) {
  const number = Math.max(1, Math.floor((Math.max(1, level) - 1) / CHAPTER_SIZE) + 1),
    start = (number - 1) * CHAPTER_SIZE + 1,
    end = start + CHAPTER_SIZE - 1;
  return { number, start, end, title: CHAPTER_NAMES[number - 1] || `Глава ${number}` };
}
function specialForLevel(level) {
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
  const ranges = { 3: [3, 4], 4: [4, 6], 5: [6, 10] },
    cr = ranges[cols];
  const cats = rnd(cr[0], cr[1], rng);
  let difficulty = level <= 12 ? 1 : level <= 35 ? 2 : level <= 80 ? 3 : level <= 160 ? 4 : 5;
  if (recovery) difficulty = Math.max(1, difficulty - 1);
  let words = difficulty === 1 ? [3, 5] : difficulty === 2 ? [4, 6] : difficulty === 3 ? [4, 7] : [5, 9];
  if (special?.bigMix) {
    cols = 5;
    const mixRange = ranges[5];
    const boostedCats = Math.min(10, Math.max(cats + 1, mixRange[0] + 1));
    words = [Math.min(8, words[0] + 1), Math.min(9, words[1] + 1)];
    return { cols, cats: boostedCats, difficulty: Math.max(2, difficulty), words };
  }
  return { cols, cats, difficulty, words };
}
function configForMode(level, mode, rng, special = null, opts = {}) {
  if (mode === "daily") return { cols: 5, cats: 7, difficulty: 3, words: [4, 7] };
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
  return regularConfig(level, rng, special);
}

function chooseCompatibleCategories(count, difficulty, rng) {
  const close = shuffle(BANK, rng).sort(
    (a, b) => Math.abs(categoryDifficulty(a) - difficulty) - Math.abs(categoryDifficulty(b) - difficulty),
  );
  const chosen = [];
  for (const cat of close) {
    if (chosen.every((c) => !categoriesConflict(cat, c))) {
      chosen.push(cat);
      if (chosen.length === count) return chosen;
    }
  }
  return [];
}
function randomColumnCounts(total, cols, rng) {
  const counts = Array(cols).fill(1),
    softMax = Math.max(2, Math.ceil(total / cols) + 2);
  let rest = total - cols;
  while (rest > 0) {
    const candidates = counts.map((n, i) => (n < softMax ? i : -1)).filter((i) => i >= 0);
    const target = candidates.length ? candidates[rnd(0, candidates.length - 1, rng)] : rnd(0, cols - 1, rng);
    counts[target]++;
    rest--;
  }
  for (let i = 0; i < cols * 5; i++) {
    const a = rnd(0, cols - 1, rng),
      b = rnd(0, cols - 1, rng);
    if (a !== b && counts[a] > 1 && counts[b] < softMax && rng() < 0.75) {
      counts[a]--;
      counts[b]++;
    }
  }
  if (new Set(counts).size === 1 && total > cols) {
    counts[0]--;
    counts[cols - 1]++;
  }
  return shuffle(counts, rng);
}
function allCards(s) {
  return [
    ...s.stock,
    ...s.waste,
    ...s.columns.flatMap((c) => c.flatMap((g) => g.cards)),
    ...s.slots.flatMap((g) => (g ? g.cards : [])),
  ];
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
function buildGeneratedLevel(level, { mode = "regular", seed = null, challengeCode = null, challengeRole = null, challengeCreatorName = null, marathonRound = 1, marathonId = null } = {}) {
  const baseSeed = seed || (mode === "daily" ? `daily:${todayKey()}` : `level:${level}`);
  for (let attempt = 0; attempt < 45; attempt++) {
    const rng = makeRng(baseSeed + ":" + attempt);
    const special = mode === "regular" ? specialForLevel(level) : null,
      cfg = configForMode(level, mode, rng, special, { marathonRound });
    const chosen = chooseCompatibleCategories(cfg.cats, cfg.difficulty, rng);
    if (chosen.length < cfg.cats) continue;
    const cards = [];
    for (const cat of chosen) {
      const maxN = Math.min(cfg.words[1], 9, cat.words.length),
        minN = Math.min(cfg.words[0], maxN),
        n = rnd(minN, maxN, rng),
        words = chooseWordsForDifficulty(cat, n, cfg.difficulty, rng);
      cards.push({ uid: uid(), cat: cat.id, label: cat.title, type: "category", total: n });
      for (const w of words) cards.push({ uid: uid(), cat: cat.id, label: w, type: "word", total: n });
    }
    const deck = shuffle(cards, rng),
      layoutCount = Math.floor(deck.length / 2),
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
      totalCategories: cfg.cats,
      categoryIds: chosen.map((c) => c.id),
      run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, startedAt: Date.now() },
      special,
      challengeCode,
      challengeRole,
      challengeCreatorName,
      marathonRound: mode === "marathon" ? marathonRound : null,
      marathonId: mode === "marathon" ? marathonId || seed : null,
      rewarded: false,
      generationAttempt: attempt,
    };
    if (isLikelySolvable(structuredClone(candidate))) return candidate;
  }
  console.warn("Solver fallback: используем последний корректно сформированный расклад");
  const rng = makeRng(baseSeed + ":fallback"),
    special = mode === "regular" ? specialForLevel(level) : null,
    cfg = configForMode(level, mode, rng, special, { marathonRound }),
    chosen = chooseCompatibleCategories(cfg.cats, cfg.difficulty, rng),
    cards = [];
  for (const cat of chosen) {
    const n = Math.min(4, cat.words.length),
      words = chooseWordsForDifficulty(cat, n, cfg.difficulty, rng);
    cards.push({ uid: uid(), cat: cat.id, label: cat.title, type: "category", total: n });
    for (const w of words) cards.push({ uid: uid(), cat: cat.id, label: w, type: "word", total: n });
  }
  const cats = cards.filter((c) => c.type === "category"),
    words = cards.filter((c) => c.type === "word"),
    stock = shuffle([...cats, ...words.slice(Math.floor(words.length / 2))], rng),
    layout = shuffle(words.slice(0, Math.floor(words.length / 2)), rng),
    counts = randomColumnCounts(layout.length, cfg.cols, rng);
  let k = 0;
  return {
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
    run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, startedAt: Date.now() },
    special,
    challengeCode,
    challengeRole,
    challengeCreatorName,
    marathonRound: mode === "marathon" ? marathonRound : null,
    marathonId: mode === "marathon" ? marathonId || seed : null,
    rewarded: false,
    generationAttempt: "fallback",
  };
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
    run: { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, startedAt: Date.now() },
    special: null,
    rewarded: false,
  };
}
function normalizeState(s) {
  s.run = { hints: 0, undos: 0, errors: 0, autoMoves: 0, moves: 0, recycles: 0, startedAt: Date.now(), ...(s.run || {}) };
  s.mode = s.mode || "regular";
  s.seed = s.seed || `legacy:${s.level || 1}`;
  s.rewarded = !!s.rewarded;
  return s;
}
function normalizeLoadedLayout(s) {
  const normalized = normalizeState(s);
  if ((normalized.cols || normalized.columns?.length || 0) <= 5) return { state: normalized, migrated: false };
  const mode = normalized.mode === "daily" ? "daily" : "regular";
  const rebuilt = buildGeneratedLevel(normalized.level || 1, { mode, seed: normalized.seed });
  return { state: rebuilt, migrated: true };
}
