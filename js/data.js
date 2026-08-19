/* Category-bank loading, validation and conflict rules. */
let CATEGORY_BANK_REPORT = { categories: 0, ambiguousWords: [], explicitConflicts: 0, warnings: [] };
const cardWordUnits = (value) => [...String(value || "").trim()].reduce((sum, ch) => {
  if (/[ЖШЩМЫЮФЦWMW]/u.test(ch)) return sum + 1.28;
  if (/[ИПНКХЧЪЫ]/u.test(ch)) return sum + 1.08;
  if (/[ijl1І]/u.test(ch)) return sum + 0.6;
  return sum + 1;
}, 0);
const fitsCardWord = (s, maxLen) => {
  s = String(s || "").trim();
  return !!s && !/[\s\-‑]/.test(s) && s.length <= maxLen && cardWordUnits(s) <= 9.7;
};
const fitsCardTitle = (s, maxLen) => {
  s = String(s || "").trim().replace(/\s+/g, " ");
  return !!s && s.length <= maxLen;
};
const sanitizeCategoryBank = (list) =>
  (Array.isArray(list) ? list : [])
    .map((cat) => {
      const uniqueWords = new Map();
      for (const raw of Array.isArray(cat.words) ? cat.words : []) {
        const word = String(raw).trim();
        const key = word.toLowerCase();
        if (fitsCardWord(word, MAX_CARD_WORD_LEN) && !uniqueWords.has(key)) uniqueWords.set(key, word);
      }
      return { ...cat, title: String(cat.title || "").trim().replace(/\s+/g, " "), words: [...uniqueWords.values()] };
    })
    .filter((cat) => fitsCardTitle(cat.title, MAX_CARD_TITLE_LEN) && cat.words.length >= 3);
const normWord = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
function categoriesConflict(a, b) {
  if (!a || !b) return false;
  if (normWord(a.title) === normWord(b.title)) return true;
  if (a.conflictGroup && a.conflictGroup === b.conflictGroup) return true;
  if (a.conflicts?.includes(b.id) || b.conflicts?.includes(a.id)) return true;
  if (a.visual || b.visual) {
    const visual = a.visual ? a : b, word = a.visual ? b : a;
    if (!!a.visual !== !!b.visual) {
      if (visual.semanticGroup && word.conflictGroup && visual.semanticGroup === word.conflictGroup) return true;
      if (word.conflictGroup && Array.isArray(visual.conflictGroups) && visual.conflictGroups.includes(word.conflictGroup)) return true;
      const visualTerms = new Set([normWord(visual.title), ...Object.values(visual.visualLabels || {}).map(normWord)]);
      const wordTerms = [normWord(word.title), ...(word.words || []).map(normWord)];
      return wordTerms.some((term) => visualTerms.has(term));
    }
    const sameVisualCollection = !!(a.visual && b.visual && a.visualCollection && a.visualCollection === b.visualCollection);
    // Categories inside one curated picture collection are intentionally meant to
    // coexist in a level. Their shared semanticGroup describes the collection,
    // not an ambiguity between its categories. Exact duplicated cards/labels are
    // still treated as a conflict below.
    if (!sameVisualCollection && a.semanticGroup && b.semanticGroup && a.semanticGroup === b.semanticGroup) return true;
    const exact = new Set((a.words || []).map(String));
    if ((b.words || []).some((w) => exact.has(String(w)))) return true;
    const labels = new Set(Object.values(a.visualLabels || {}).map(normWord));
    return Object.values(b.visualLabels || {}).some((label) => labels.has(normWord(label)));
  }
  const aw = new Set(a.words.map(normWord));
  return b.words.some((w) => aw.has(normWord(w)));
}

function validateCategoryBank(list = BANK) {
  const wordOwners = new Map(), titleOwners = new Map(), warnings = [];
  for (const cat of list) {
    const titleKey = normWord(cat.title);
    if (!titleOwners.has(titleKey)) titleOwners.set(titleKey, []);
    titleOwners.get(titleKey).push(cat.id);
    if (cat.words.length < 3) warnings.push(`${cat.title}: меньше 3 слов`);
    for (const word of cat.words) {
      const key = normWord(word);
      if (!wordOwners.has(key)) wordOwners.set(key, []);
      wordOwners.get(key).push({ id: cat.id, title: cat.title, word });
    }
  }
  const ambiguousWords = [...wordOwners.entries()]
    .filter(([, owners]) => new Set(owners.map((x) => x.id)).size > 1)
    .map(([word, owners]) => ({ word, categories: owners.map((x) => x.title) }))
    .sort((a, b) => b.categories.length - a.categories.length || a.word.localeCompare(b.word));
  CATEGORY_BANK_REPORT = {
    categories: list.length,
    words: [...wordOwners.values()].reduce((n, x) => n + x.length, 0),
    ambiguousWords,
    explicitConflicts: list.reduce((n, c) => n + (c.conflicts?.length || 0), 0),
    duplicateTitles: [...titleOwners.entries()].filter(([, ids]) => ids.length > 1).map(([title, ids]) => ({ title, ids })),
    warnings,
  };
  return CATEGORY_BANK_REPORT;
}

function getRecentCategories() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}
function rememberCategories(ids) {
  const recent = getRecentCategories().filter((id) => !ids.includes(id));
  localStorage.setItem(RECENT_KEY, JSON.stringify([...ids, ...recent].slice(0, 40)));
}
async function loadCategoryBank() {
  const useFallback = () => {
    BANK = sanitizeCategoryBank(window.CATEGORY_BANK || []);
  };
  if (location.protocol === "file:") {
    useFallback();
  } else {
    try {
      const r = await fetch("./data/categories.json", { cache: "no-store" });
      if (!r.ok) throw new Error("categories.json " + r.status);
      const data = await r.json();
      BANK = sanitizeCategoryBank(data.categories);
    } catch (err) {
      console.warn("categories.json недоступен, использую fallback", err);
      useFallback();
    }
  }
  if (BANK.length < 50) throw new Error("База категорий не загружена");
  validateCategoryBank(BANK);
}
