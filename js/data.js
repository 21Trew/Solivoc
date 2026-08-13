/* Category-bank loading, validation and conflict rules. */
const fitsCardText = (s, maxLen) => {
  s = String(s || "").trim();
  return !!s && !/[\s\-‑]/.test(s) && s.length <= maxLen;
};
const sanitizeCategoryBank = (list) =>
  (Array.isArray(list) ? list : [])
    .map((cat) => {
      const uniqueWords = new Map();
      for (const raw of Array.isArray(cat.words) ? cat.words : []) {
        const word = String(raw).trim();
        const key = word.toLowerCase();
        if (fitsCardText(word, MAX_CARD_WORD_LEN) && !uniqueWords.has(key)) uniqueWords.set(key, word);
      }
      return { ...cat, title: String(cat.title || "").trim(), words: [...uniqueWords.values()] };
    })
    .filter((cat) => fitsCardText(cat.title, MAX_CARD_TITLE_LEN) && cat.words.length >= 3);
const normWord = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim();
function categoriesConflict(a, b) {
  if (!a || !b) return false;
  if (a.conflictGroup && a.conflictGroup === b.conflictGroup) return true;
  if (a.conflicts?.includes(b.id) || b.conflicts?.includes(a.id)) return true;
  const aw = new Set(a.words.map(normWord));
  return b.words.some((w) => aw.has(normWord(w)));
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
}
