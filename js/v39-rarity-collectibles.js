/* Словасьянс v39: unified folklore rarity + collectibles foundation. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.__solivocV39Installed) return;
  root.__solivocV39Installed = true;

  const esc = (value) => typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const rarityIds = typeof RARITY_IDS !== "undefined" ? RARITY_IDS : ["common","uncommon","rare","epic","legendary"];
  const rarity = (id) => typeof rarityDef === "function" ? rarityDef(id) : ({
    common:{color:"#a9b0bb",labels:{m:"Простой",f:"Простая",n:"Простое",plural:"Простые"},weight:1},
    uncommon:{color:"#6fbd91",labels:{m:"Дивный",f:"Дивная",n:"Дивное",plural:"Дивные"},weight:7},
    rare:{color:"#6f9fc5",labels:{m:"Вещий",f:"Вещая",n:"Вещее",plural:"Вещие"},weight:49},
    epic:{color:"#9476bd",labels:{m:"Заповедный",f:"Заповедная",n:"Заповедное",plural:"Заповедные"},weight:343},
    legendary:{color:"#c9aa62",labels:{m:"Сокровенный",f:"Сокровенная",n:"Сокровенное",plural:"Сокровенные"},weight:2401},
  }[id] || null);

  function sourceLabel(source) { return source?.label || "Прогресс"; }
  function howToUnlock(type, def) {
    if (!def) return "Условие пока неизвестно.";
    if (def.unlockText) return def.unlockText;
    if (type === "theme") return def.stars ? `Собери ${def.stars} ★.` : "Доступно изначально.";
    if (type === "cardBack") return def.desc || "Продвигайся по коллекции.";
    if (type === "frame") return def.minDuelXp ? `Набери ${def.minDuelXp} дуэльного XP.` : def.chapter ? `Пройди главу ${def.chapter}.` : "Доступно изначально.";
    if (type === "avatar") return def.unlock?.type === "rank" ? `Достигни ранга ${def.unlock.rank}.` : def.unlock?.type === "days" ? `Открой игру в ${def.unlock.days} разных дней.` : "Доступно изначально.";
    if (type === "title") return def.minXp ? `Набери ${def.minXp} XP.` : def.achievement ? `Получи достижение «${ACHIEVEMENTS.find((a)=>a.id===def.achievement)?.title || def.achievement}».` : "Доступно изначально.";
    return "Продолжай исследовать Словасьянс.";
  }

  function allTitleDefs() {
    const fixed = typeof TITLE_DEFS !== "undefined" ? TITLE_DEFS : [];
    const fromAchievements = typeof ACHIEVEMENTS !== "undefined" && typeof achievementTitleDef === "function" ? ACHIEVEMENTS.map(achievementTitleDef).filter(Boolean) : [];
    const byId = new Map();
    [...fixed, ...fromAchievements].forEach((def) => { if (def?.id && !byId.has(def.id)) byId.set(def.id, def); });
    return [...byId.values()];
  }
  function catalogGroups() {
    return [
      ["theme", typeof THEME_DEFS !== "undefined" ? THEME_DEFS : []],
      ["cardBack", typeof CARD_BACK_DEFS !== "undefined" ? CARD_BACK_DEFS : []],
      ["frame", typeof FRAME_DEFS !== "undefined" ? FRAME_DEFS : []],
      ["avatar", typeof AVATAR_DEFS !== "undefined" ? AVATAR_DEFS : []],
      ["title", allTitleDefs()],
      ["relic", typeof RELIC_DEFS !== "undefined" ? RELIC_DEFS : []],
      ["mascotHome", typeof MASCOT_HOME_ITEM_DEFS !== "undefined" ? MASCOT_HOME_ITEM_DEFS : []],
    ];
  }
  function validateCollectibleCatalog() {
    const errors = [];
    for (const [type, defs] of catalogGroups()) for (const def of defs) {
      if (!def?.id && type !== "avatar") errors.push(`${type}:missing-id`);
      if (!def?.rarity || !rarityIds.includes(def.rarity)) errors.push(`${type}:${def?.id || def?.emoji}:missing-rarity`);
      if (!def?.source?.type) errors.push(`${type}:${def?.id || def?.emoji}:missing-source`);
    }
    return errors;
  }
  root.__solivocV39Test = Object.freeze({ validateCollectibleCatalog, catalogGroups, allTitleDefs, howToUnlock });
  const bootErrors = validateCollectibleCatalog();
  if (bootErrors.length) console.error("Collectible catalog contract failed", bootErrors);
  if (typeof document === "undefined") return;

  function installStyles() {
    if (document.querySelector('link[data-v39-rarity-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles/v39-rarity-collectibles.css";
    link.dataset.v39RarityStyles = "1";
    document.head?.appendChild(link);
  }
  installStyles();

  const filterState = { themes:"all", backs:"all", frames:"all", avatars:"all", titles:"all" };
  function filtersMarkup(scope, defs) {
    const counts = Object.fromEntries(rarityIds.map((id)=>[id,0]));
    defs.forEach((def)=>{ if (counts[def?.rarity] !== undefined) counts[def.rarity]++; });
    return `<div class="v39-rarity-filters" data-v39-filter-bar="${scope}">${[["all","Все",defs.length],...rarityIds.map((id)=>[id,rarity(id).labels.plural,counts[id]])].map(([id,label,count])=>`<button type="button" class="${filterState[scope]===id?"active":""}" data-v39-rarity-filter="${id}" data-v39-filter-scope="${scope}" style="--rarity:${id==="all"?"rgba(255,255,255,.35)":rarity(id).color}"><span>${label}</span><small>${count}</small></button>`).join("")}</div>`;
  }
  function setRarityVisual(node, def) {
    if (!node || !def?.rarity) return;
    node.dataset.v39Rarity = def.rarity;
    node.style.setProperty("--v39-rarity", rarity(def.rarity).color);
    node.classList.toggle("v39-sokrovennoe", def.rarity === "legendary");
  }
  function applyFilter(scope, container = document) {
    const value = filterState[scope] || "all";
    const rootNode = container.querySelector?.(`[data-v39-filter-root="${scope}"]`) || container;
    rootNode.querySelectorAll?.("[data-v39-rarity]").forEach((node)=>node.classList.toggle("v39-rarity-hidden", value !== "all" && node.dataset.v39Rarity !== value));
    rootNode.querySelectorAll?.(`[data-v39-filter-bar="${scope}"] [data-v39-rarity-filter]`).forEach((button)=>button.classList.toggle("active", button.dataset.v39RarityFilter === value));
    rootNode.classList?.toggle("v39-filtering", value !== "all");
  }
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-v39-rarity-filter]");
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const scope = String(button.dataset.v39FilterScope || "");
    if (!(scope in filterState)) return;
    filterState[scope] = String(button.dataset.v39RarityFilter || "all");
    applyFilter(scope, button.closest("[data-v39-filter-root]") || document);
  });

  function defBy(type, id) {
    if (type === "theme") return THEME_DEFS.find((x)=>x.id===id);
    if (type === "cardBack") return CARD_BACK_DEFS.find((x)=>x.id===id);
    if (type === "frame") return FRAME_DEFS.find((x)=>x.id===id);
    if (type === "avatar") return AVATAR_DEFS.find((x)=>x.id===id || x.emoji===id);
    if (type === "title") return allTitleDefs().find((x)=>x.id===id);
    if (type === "relic") return RELIC_DEFS.find((x)=>x.id===id);
    return null;
  }
  function ensureInfoModal() {
    let modal = document.querySelector("#v39CollectibleInfo");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "v39CollectibleInfo"; modal.className = "v39-collectible-modal"; modal.hidden = true;
    modal.innerHTML = `<div class="v39-collectible-card"><button type="button" class="v39-collectible-close" aria-label="Закрыть">×</button><div class="v39-collectible-body"></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".v39-collectible-close").onclick=()=>modal.hidden=true;
    modal.onclick=(e)=>{if(e.target===modal)modal.hidden=true;};
    return modal;
  }
  function openInfo(type, id, unlocked = false) {
    const def=defBy(type,id); if(!def)return;
    const modal=ensureInfoModal(), body=modal.querySelector(".v39-collectible-body"), r=rarity(def.rarity);
    const gender=type==="title"?"m":type==="theme"?"f":type==="relic"?"f":"f";
    body.innerHTML=`<i class="v39-info-icon" style="--rarity:${r.color}">${esc(def.icon||def.emoji||"✦")}</i><small style="--rarity:${r.color}">${esc(r.labels[gender]||r.labels.n)} · вес ${r.weight}</small><h2>${esc(def.name||def.emoji||"Предмет")}</h2>${def.lore?`<p>${esc(def.lore)}</p>`:""}<dl><div><dt>Источник</dt><dd>${esc(sourceLabel(def.source))}</dd></div><div><dt>${unlocked?"Обретено":"Как получить"}</dt><dd>${esc(unlocked?"Уже в коллекции":howToUnlock(type,def))}</dd></div></dl>`;
    modal.hidden=false;
  }
  document.addEventListener("click",(event)=>{
    const info=event.target?.closest?.("[data-v39-info-type]");
    if(!info)return;
    if(info.classList.contains("locked") || info.dataset.v39InfoType==="relic") {
      if(info.classList.contains("locked")){event.preventDefault();event.stopImmediatePropagation();}
      openInfo(info.dataset.v39InfoType,info.dataset.v39InfoId,info.dataset.v39Unlocked==="1");
    }
  },true);

  function decorateAppearanceSection(scope, type, selector, defs) {
    const section=document.querySelector(`[data-cosmetic-section="${scope}"]`); if(!section)return;
    section.dataset.v39FilterRoot=scope;
    section.querySelector(".v35-cardback-filters")?.remove();
    let bar=section.querySelector(`[data-v39-filter-bar="${scope}"]`);
    if(!bar){const holder=document.createElement("div");holder.innerHTML=filtersMarkup(scope,defs);bar=holder.firstElementChild;section.querySelector(".cosmetic-clip")?.before(bar);}
    const byId=new Map(defs.map((d)=>[String(d.id),d]));
    section.querySelectorAll(selector).forEach((tile)=>{
      const rawId=tile.dataset.themeId||tile.dataset.cardBackId||tile.dataset.frameId; const def=byId.get(String(rawId)); if(!def)return;
      setRarityVisual(tile,def); tile.dataset.v39InfoType=type;tile.dataset.v39InfoId=def.id;tile.classList.remove("v35-rarity-hidden");
      const locked=tile.classList.contains("locked")||tile.disabled;
      tile.querySelector(".v39-unlock-line")?.remove();
      if(locked){const line=document.createElement("small");line.className="v39-unlock-line";line.textContent=`${sourceLabel(def.source)} · ${howToUnlock(type,def)}`;tile.appendChild(line);}
    });
    applyFilter(scope,section);
  }
  function decorateAppearance() {
    decorateAppearanceSection("themes","theme","[data-theme-id]",THEME_DEFS);
    decorateAppearanceSection("backs","cardBack","[data-card-back-id]",CARD_BACK_DEFS);
    decorateAppearanceSection("frames","frame","[data-frame-id]",FRAME_DEFS);
  }

  if (typeof avatarEmojiMarkup === "function") {
    avatarEmojiMarkup = function v39AvatarMarkup(selectedEmoji = profile.avatarEmoji) {
      const defs=AVATAR_DEFS;
      return `<div class="v39-inline-collection" data-v39-filter-root="avatars">${filtersMarkup("avatars",defs)}<div class="avatar-emoji-grid">${defs.map((def)=>{const unlocked=avatarUnlocked(def,profile);return `<button type="button" class="avatar-emoji v39-avatar ${selectedEmoji===def.emoji?"selected":""} ${unlocked?"":"locked"}" data-profile-avatar="${esc(def.emoji)}" data-v39-rarity="${def.rarity}" style="--v39-rarity:${rarity(def.rarity).color}" ${unlocked?"":"disabled"} aria-label="Аватар ${esc(def.emoji)}"><b>${esc(def.emoji)}</b>${unlocked?"":`<small>${esc(howToUnlock("avatar",def))}</small>`}</button>`}).join("")}</div></div>`;
    };
  }
  if (typeof titlePillsMarkup === "function") {
    titlePillsMarkup = function v39TitleMarkup(selectedTitle = profile.titleId) {
      const defs=allTitleDefs();
      return `<div class="v39-inline-collection" data-v39-filter-root="titles">${filtersMarkup("titles",defs)}<div class="title-pill-grid">${defs.map((def)=>{const unlocked=(!def.minXp||(+profile.xp||0)>=def.minXp)&&(!def.achievement||(profile.achievements||[]).includes(def.achievement));return `<button type="button" class="title-pill v39-title ${selectedTitle===def.id?"selected":""} ${unlocked?"":"locked"}" data-profile-title="${def.id}" data-v39-rarity="${def.rarity}" style="--v39-rarity:${rarity(def.rarity).color}" ${unlocked?"":"disabled"}><i>${esc(def.icon)}</i><span>${esc(def.name)}</span>${unlocked?"":`<small>${esc(howToUnlock("title",def))}</small>`}</button>`}).join("")}</div></div>`;
    };
  }

  // Old achievement rarity wording stays technically compatible, but players see the folklore language.
  if (typeof achievementCardMarkup === "function") {
    const baseAchievementCardMarkup=achievementCardMarkup;
    achievementCardMarkup=function v39AchievementCard(a){return baseAchievementCardMarkup(a).replace(" · легендарное"," · Заповедное").replace(" · редкое"," · Вещее");};
  }
  if (typeof progressTabMarkup === "function") {
    const baseProgressTabMarkup=progressTabMarkup;
    progressTabMarkup=function v39ProgressTab(...args){return baseProgressTabMarkup.apply(this,args).replace(/>Редкие</g,">Вещие<").replace(/>Легендарные</g,">Заповедные<");};
  }

  function ensureCollectibles() {
    profile.collectibles ||= {version:1,unlocked:[],discovered:[],seen:[]};
    profile.collectibles.version=1;
    for(const key of ["unlocked","discovered","seen"])profile.collectibles[key]=[...new Set((Array.isArray(profile.collectibles[key])?profile.collectibles[key]:[]).map(String))].slice(0,500);
    return profile.collectibles;
  }
  function syncRelics() {
    const bag=ensureCollectibles(); let changed=false;
    for(const def of RELIC_DEFS){if(!def.unlocked?.(profile))continue;for(const key of ["unlocked","discovered"]){if(!bag[key].includes(def.id)){bag[key].push(def.id);changed=true;}}}
    if(changed)try{saveProfile?.();}catch{}
    return bag;
  }
  function relicsMarkup() {
    const bag=syncRelics(), unlocked=new Set(bag.unlocked||[]);
    return `<section class="hub-section v39-relic-section"><div class="hub-section-head"><div><h3>Реликвии</h3><small>${unlocked.size}/${RELIC_DEFS.length} · память о важных путях</small></div></div><div class="v39-relic-grid">${RELIC_DEFS.map((def)=>{const got=unlocked.has(def.id), hidden=!got&&def.hiddenUntilHint, r=rarity(def.rarity);return `<button type="button" class="v39-relic ${got?"unlocked":"locked"} ${def.rarity==="legendary"?"v39-sokrovennoe":""}" data-v39-info-type="relic" data-v39-info-id="${def.id}" data-v39-unlocked="${got?1:0}" data-v39-rarity="${def.rarity}" style="--v39-rarity:${r.color}"><i>${hidden?"?":esc(def.icon||"✦")}</i><span><small>${esc(r.labels.f)} реликвия</small><b>${hidden?"???":esc(def.name)}</b><em>${got?esc(sourceLabel(def.source)):hidden?"Намёк откроется позже":esc(howToUnlock("relic",def))}</em></span></button>`}).join("")}</div></section>`;
  }
  if(typeof collectionTabMarkup==="function"){
    const baseCollectionTabMarkup=collectionTabMarkup;
    collectionTabMarkup=function v39CollectionTab(...args){return `${baseCollectionTabMarkup.apply(this,args)}${relicsMarkup()}`;};
  }
  if(typeof renderHub==="function"){
    const baseRenderHub=renderHub;
    renderHub=function v39RenderHub(...args){const result=baseRenderHub.apply(this,args);queueMicrotask(()=>{decorateAppearance();syncRelics();});return result;};
  }

  queueMicrotask(()=>{decorateAppearance();syncRelics();});
})();
