/* Admin extension: compose in-game developer letters. */
(() => {
  if (window.__solivocAdminMailInstalled) return;
  window.__solivocAdminMailInstalled = true;
  const panel = document.querySelector("#adminPanel");
  if (!panel) return;

  const box = document.createElement("section");
  box.className = "admin-mail-box";
  box.innerHTML = `
    <div class="admin-mail-head"><div><small>ВНУТРИИГРОВАЯ ПОЧТА</small><h2>Письмо разработчика</h2></div><small>без push и без всплывающего патчноута</small></div>
    <div class="admin-mail-grid">
      <label>Получатель<select id="adminMailRecipient"><option value="all">Все зарегистрированные игроки</option></select></label>
      <label>Заголовок<input id="adminMailTitle" maxlength="80" placeholder="Например: Небольшое обновление"></label>
      <label class="full">Вступление<textarea id="adminMailIntro" maxlength="320" placeholder="Короткий текст письма"></textarea></label>
      <label class="full">Пункты письма<textarea id="adminMailItems" maxlength="1600" placeholder="Каждый пункт с новой строки"></textarea></label>
    </div>
    <div class="admin-mail-actions"><span id="adminMailStatus" role="status" aria-live="polite"></span><button id="adminMailSend" type="button">Отправить письмо</button></div>`;
  panel.querySelector(".admin-actions")?.before(box);

  const recipient = box.querySelector("#adminMailRecipient"), status = box.querySelector("#adminMailStatus"), send = box.querySelector("#adminMailSend");
  function setStatus(text = "", danger = false) { status.textContent = text; status.classList.toggle("danger", !!danger); }
  function populateRecipients(data) {
    if (!recipient) return;
    const selected = recipient.value || "all";
    const accounts = (data?.players || []).filter((p) => p?.account && p?.id);
    recipient.innerHTML = `<option value="all">Все зарегистрированные игроки</option>${accounts.map((p) => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.name || "Игрок")} · ${escapeHtml(p.email || p.id)}</option>`).join("")}`;
    if ([...recipient.options].some((option) => option.value === selected)) recipient.value = selected;
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function adminMailAwareRender(data) {
      const result = baseRender(data);
      populateRecipients(data);
      return result;
    };
  }
  try { if (typeof adminData !== "undefined" && adminData) populateRecipients(adminData); } catch {}

  send?.addEventListener("click", async () => {
    const target = recipient?.value || "all";
    const title = box.querySelector("#adminMailTitle")?.value.trim() || "";
    const intro = box.querySelector("#adminMailIntro")?.value.trim() || "";
    const items = (box.querySelector("#adminMailItems")?.value || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
    if (!title || !intro) return setStatus("Нужны заголовок и вступление.", true);
    if (target === "all" && !confirm("Отправить это письмо всем зарегистрированным игрокам?")) return;
    send.disabled = true; setStatus("Отправляю…");
    try {
      const response = await apiFetch("/api/admin/mail", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ target, title, intro, items }),
        cache:"no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.message || data.error || `HTTP ${response.status}`), { status:response.status });
      box.querySelector("#adminMailTitle").value = "";
      box.querySelector("#adminMailIntro").value = "";
      box.querySelector("#adminMailItems").value = "";
      setStatus(target === "all" ? "Письмо отправлено всем игрокам." : "Письмо отправлено выбранному игроку.");
    } catch (error) {
      setStatus(error?.status === 401 ? "Админ-сессия истекла. Войди снова." : (error?.message || "Не удалось отправить письмо."), true);
    } finally { send.disabled = false; }
  });
})();
