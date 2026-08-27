/* Player-facing Forest Knowledge + Relationship UX. Reads only the safe knowledge-ui projection. */
(() => {
  if (globalThis.SolivocForestKnowledgeUI) return;
  const WORLD = "forest", VER = "0.03", FILE = "data/knowledge-ui.json", CONTRACT = "forest-knowledge-ui@1";
  const URL = "/api/semantic-events?projection=1&view=knowledge-ui&world=forest";
  let contract = null, loading = null, installed = false, activeGroup = "observation";
  const arr = (v) => Array.isArray(v) ? v : [];
  const obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
  const txt = (v) => String(v ?? "").trim();
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const levelFromScene = (id) => { const m = /_L(\d{3})_/.exec(txt(id)); return m ? Number(m[1]) : null; };

  function validateContract(v) {
    const errors = [];
    if (v?.schemaVersion !== 1) errors.push("schema");
    if (v?.worldId !== WORLD) errors.push("world");
    if (v?.packageVersion !== VER) errors.push("package");
    if (v?.uxContractVersion !== CONTRACT) errors.push("contract");
    if (arr(v?.groups).map(x => x.id).join(",") !== "observation,character,companion") errors.push("groups");
    const ids = new Set(), states = new Set();
    for (const d of arr(v?.definitions)) {
      if (!txt(d?.id) || ids.has(d.id) || !txt(d?.displayStateKey) || states.has(d.displayStateKey) || !txt(d?.title)) errors.push("definition");
      ids.add(d?.id); states.add(d?.displayStateKey);
    }
    return { ok: errors.length === 0, errors: [...new Set(errors)] };
  }

  async function loadContract() {
    if (contract) return contract;
    if (!loading) loading = (async () => {
      const content = globalThis.SolivocWorldContent;
      if (!content?.loadManifest || !content?.loadRuntimeFile) throw new Error("world_content_loader_unavailable");
      const manifest = await content.loadManifest(WORLD, VER);
      if (!arr(manifest?.runtimeFiles).includes(FILE)) throw new Error("knowledge_ui_not_in_manifest");
      const value = await content.loadRuntimeFile(manifest, FILE);
      const validation = validateContract(value);
      if (!validation.ok) throw Object.assign(new Error("invalid_knowledge_ui_contract"), { validation });
      return contract = Object.freeze(value);
    })().catch((error) => { loading = null; throw error; });
    return loading;
  }

  async function projection() {
    if (typeof globalThis.accountSignedIn === "function" && !globalThis.accountSignedIn()) return { status:"unavailable", reason:"auth_required" };
    if (typeof globalThis.apiFetch !== "function") return { status:"unavailable", reason:"api_unavailable" };
    try {
      await globalThis.SolivocForestStory?.sync?.();
      if (arr(await globalThis.SolivocNarrativeStore?.pending?.(1)).length) return { status:"unavailable", reason:"semantic_commands_pending" };
      const response = await globalThis.apiFetch(URL, { cache:"no-store" });
      if (!response?.ok) return { status:"unavailable", reason:`projection_http_${response?.status || "error"}` };
      const data = await response.json();
      return data?.projection?.world_id === WORLD ? { status:"ready", projection:data.projection } : { status:"unavailable", reason:"invalid_projection" };
    } catch {
      return { status:"unavailable", reason:"projection_network_error" };
    }
  }

  function definitionMap(c) { return new Map(arr(c?.definitions).map((d) => [d.displayStateKey, d])); }
  function buildModel(p, c) {
    const defs = definitionMap(c), groups = Object.fromEntries(arr(c.groups).map(g => [g.id, []]));
    for (const record of arr(p?.knowledge?.records)) {
      const group = txt(record?.presentation_group);
      if (!groups[group]) continue;
      const d = defs.get(txt(record?.display_state_key));
      if (!d) continue;
      groups[group].push({
        type:"knowledge", id:txt(record.knowledge_record_id), title:d.title, kind:c.kindLabels?.[record.record_kind] || c.kindLabels?.[d.kind] || "Наблюдение",
        confidence:c.confidence?.[record.confidence] || c.confidence?.SUSPECTED || "Предположение", confidenceKey:record.confidence || "SUSPECTED",
        displayStateKey:txt(record.display_state_key), provenance:obj(record.provenance), linkedCount:Number(record.linked_record_count) || 0, reconstructionCount:Number(record.reconstruction_count) || 0,
      });
    }
    for (const [characterId, relationship] of Object.entries(obj(p?.relationships))) {
      const character = c.characters?.[characterId]; if (!character) continue;
      const group = relationship?.presentation_group === "companion" ? "companion" : "character";
      const earned = arr(c.relationship?.milestones).filter(m => relationship?.milestones?.[m.key] === true);
      groups[group].unshift({
        type:"relationship", id:`relationship:${characterId}`, characterId, title:character.name, avatar:character.avatar,
        acquainted:relationship?.acquainted === true, earned, perspectiveSeen:relationship?.borrowed_perspective?.seen === true,
        perspectiveVoluntary:relationship?.borrowed_perspective?.voluntarily_used === true, sharedHistoryCount:Math.max(0, Number(relationship?.shared_history_count) || 0),
      });
      groups[group] = groups[group].filter((item) => item.type !== "knowledge" || ![`character.${characterId}`,`companion.${characterId}`].includes(item.displayStateKey));
    }
    return { groups, sourceSequence:Number(p?.source_sequence) || 0, firstCompanion:txt(p?.synthesis?.first_companion) || null };
  }

  function styles() {
    if (typeof document === "undefined" || document.getElementById("forestKnowledgeStyles")) return;
    const s = document.createElement("style"); s.id = "forestKnowledgeStyles";
    s.textContent = `.story-knowledge-entry{grid-column:1/-1;min-height:48px;border:1px solid #ffffff15;border-radius:16px;background:#ffffff08;color:#fff;padding:0 14px;display:flex;align-items:center;justify-content:space-between;font-weight:850}.story-knowledge-entry small{color:#aebbd0;font-size:8px}.forest-knowledge-modal{position:fixed;inset:0;z-index:14220;display:grid;place-items:center;padding:12px;background:#070a17e8;backdrop-filter:blur(14px)}.forest-knowledge-modal[hidden]{display:none}.forest-knowledge-shell{width:min(760px,100%);max-height:calc(100vh - 24px);overflow:hidden;border:1px solid #ffffff1b;border-radius:28px;background:#11192c;color:#fff;display:grid;grid-template-rows:auto auto 1fr}.forest-knowledge-head{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 12px}.forest-knowledge-head h2{margin:0;font-size:22px}.forest-knowledge-close{width:38px;height:38px;border:0;border-radius:12px;background:#ffffff0d;color:#fff}.forest-knowledge-tabs{display:flex;gap:6px;padding:0 20px 12px;overflow:auto}.forest-knowledge-tabs button{border:1px solid #ffffff13;border-radius:999px;background:#ffffff06;color:#c9d2dd;padding:8px 12px;white-space:nowrap;font-weight:800;font-size:10px}.forest-knowledge-tabs button.active{background:#edf2df;color:#21332d}.forest-knowledge-list{overflow:auto;padding:0 20px 20px;display:grid;gap:9px}.forest-knowledge-card{border:1px solid #ffffff12;border-radius:18px;background:#ffffff06;padding:14px}.forest-knowledge-card-head{display:flex;gap:11px;align-items:center}.forest-knowledge-card img{width:48px;height:48px}.forest-knowledge-card h3{margin:0;font-size:15px}.forest-knowledge-meta{font-size:9px;color:#9fb0c3;margin-top:3px}.forest-knowledge-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}.forest-knowledge-chip{border-radius:999px;background:#ffffff0b;padding:5px 8px;font-size:8px;color:#d8e1df}.forest-knowledge-note{margin-top:9px;color:#b9c6c6;font-size:10px;line-height:1.45}.forest-knowledge-empty{padding:24px;border:1px dashed #ffffff16;border-radius:18px;color:#9faabb;font-size:11px;line-height:1.5}.forest-knowledge-error{padding:24px;color:#c9d2dd;font-size:11px}@media(max-width:520px){.forest-knowledge-shell{height:calc(100vh - 24px)}.forest-knowledge-head{padding-inline:15px}.forest-knowledge-tabs,.forest-knowledge-list{padding-inline:15px}}`;
    document.head.appendChild(s);
  }

  function ensureModal() {
    let modal = document.getElementById("forestKnowledgeModal"); if (modal) return modal;
    modal = document.createElement("div"); modal.id = "forestKnowledgeModal"; modal.className = "forest-knowledge-modal"; modal.hidden = true;
    modal.innerHTML = `<section class="forest-knowledge-shell" role="dialog" aria-modal="true" aria-labelledby="forestKnowledgeTitle"><header class="forest-knowledge-head"><div><small>ИСТОРИЯ ЗНАНИЯ</small><h2 id="forestKnowledgeTitle">Лес</h2></div><button class="forest-knowledge-close" type="button" aria-label="Закрыть">×</button></header><nav class="forest-knowledge-tabs"></nav><div class="forest-knowledge-list"></div></section>`;
    document.body.appendChild(modal); modal.querySelector(".forest-knowledge-close").onclick = () => { modal.hidden = true; }; return modal;
  }

  function renderKnowledge(item) {
    const levels = arr(item.provenance?.scene_ids).map(levelFromScene).filter(Boolean);
    const where = levels.length ? `Впервые связано с ур. ${Math.min(...levels)}` : "";
    const provenance = [item.confidence, item.kind, where].filter(Boolean).join(" · ");
    const extras = []; if (item.linkedCount) extras.push(`Связано записей: ${item.linkedCount}`); if (item.reconstructionCount) extras.push(`Реконструкций: ${item.reconstructionCount}`);
    return `<article class="forest-knowledge-card"><h3>${esc(item.title)}</h3><div class="forest-knowledge-meta">${esc(provenance)}</div>${extras.length ? `<div class="forest-knowledge-chips">${extras.map(x=>`<span class="forest-knowledge-chip">${esc(x)}</span>`).join("")}</div>` : ""}</article>`;
  }

  function renderRelationship(item, c) {
    const perspective = item.perspectiveVoluntary ? c.relationship?.perspectiveVoluntary : item.perspectiveSeen ? c.relationship?.perspectiveSeen : "";
    const chips = [item.acquainted ? c.relationship?.acquaintedLabel : null, ...item.earned.map(x => x.label)].filter(Boolean);
    return `<article class="forest-knowledge-card"><div class="forest-knowledge-card-head"><img src="${esc(item.avatar)}" alt=""><div><h3>${esc(item.title)}</h3><div class="forest-knowledge-meta">${item.sharedHistoryCount ? `Совместная история · ${item.sharedHistoryCount} эп.` : "История отношений"}</div></div></div>${chips.length ? `<div class="forest-knowledge-chips">${chips.map(x=>`<span class="forest-knowledge-chip">${esc(x)}</span>`).join("")}</div>` : ""}${perspective ? `<div class="forest-knowledge-note">${esc(perspective)}</div>` : ""}</article>`;
  }

  function renderGroup(model, c, groupId) {
    const modal = ensureModal(), group = arr(c.groups).find(g => g.id === groupId) || c.groups[0], items = model.groups[group.id] || [];
    modal.querySelector(".forest-knowledge-tabs").innerHTML = arr(c.groups).map(g => `<button type="button" data-knowledge-group="${esc(g.id)}" class="${g.id === group.id ? "active" : ""}">${esc(g.label)} <small>${model.groups[g.id]?.length || 0}</small></button>`).join("");
    modal.querySelector(".forest-knowledge-list").innerHTML = items.length ? items.map(i => i.type === "relationship" ? renderRelationship(i,c) : renderKnowledge(i)).join("") : `<div class="forest-knowledge-empty">${esc(group.empty)}</div>`;
    for (const button of modal.querySelectorAll("[data-knowledge-group]")) button.onclick = () => { activeGroup = button.dataset.knowledgeGroup; renderGroup(model,c,activeGroup); };
  }

  async function open() {
    if (typeof document === "undefined") return { status:"no-dom" };
    styles(); const modal = ensureModal(); modal.hidden = false; modal.querySelector(".forest-knowledge-list").innerHTML = `<div class="forest-knowledge-error">Собираю твою историю Леса…</div>`;
    const c = await loadContract(), projected = await projection();
    if (projected.status !== "ready") {
      const message = projected.reason === "auth_required" ? "История знаний синхронизируется с аккаунтом. Войди в аккаунт, чтобы открыть её." : "Сейчас история знаний недоступна. Ничего не потеряно — данные остаются в истории событий.";
      modal.querySelector(".forest-knowledge-tabs").innerHTML = ""; modal.querySelector(".forest-knowledge-list").innerHTML = `<div class="forest-knowledge-error">${esc(message)}</div>`; return projected;
    }
    const model = buildModel(projected.projection, c); renderGroup(model, c, activeGroup); return { status:"ready", model };
  }

  function installGateway() {
    if (installed || typeof document === "undefined" || typeof globalThis.homeTabMarkup !== "function" || typeof globalThis.bindHubHandlers !== "function") return false;
    installed = true; styles();
    const home = globalThis.homeTabMarkup;
    globalThis.homeTabMarkup = () => { const html = home(); const button = `<button type="button" class="story-knowledge-entry" data-story-knowledge><span><b>Знания Леса</b><br><small>наблюдения, персонажи и спутники</small></span><span>⌁ →</span></button>`; return html.replace("</section>", `${button}</section>`); };
    const bind = globalThis.bindHubHandlers;
    globalThis.bindHubHandlers = function(...args) { const result = bind.apply(this,args); document.querySelector("[data-story-knowledge]")?.addEventListener("click", () => open().catch(console.error)); return result; };
    return true;
  }

  function bootInstall() { if (installGateway()) return; let tries = 0; const timer = setInterval(() => { if (installGateway() || ++tries > 120) clearInterval(timer); }, 50); }

  globalThis.SolivocForestKnowledgeUI = Object.freeze({ contractFile:FILE, contractVersion:CONTRACT, validateContract, loadContract, projection, buildModel, open, installGateway });
  if (typeof document !== "undefined") bootInstall();
})();
