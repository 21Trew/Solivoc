/* Reusable presentational helpers shared across the hub and retention views. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function progressMeterMarkup(ratio, className = "ui-progress") {
  const value = Math.max(0, Math.min(1, +ratio || 0));
  return `<span class="${className}"><i style="width:${value * 100}%"></i></span>`;
}

function modeCardMarkup({ id, icon, label, className = "", description = "", meta = "" }) {
  return `<button class="mode-card ${className}" data-game-mode="${id}"><i>${icon}</i><b>${escapeHtml(label)}</b><span>${escapeHtml(description)}</span>${meta ? `<em>${escapeHtml(meta)}</em>` : ""}</button>`;
}

function statBoxMarkup(value, label) {
  return `<div class="stat-box"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function pillMarkup(icon, title, subtitle = "", className = "") {
  return `<span class="ui-pill ${className}"><i>${icon}</i><span><b>${escapeHtml(title)}</b>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}</span></span>`;
}
