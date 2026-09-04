/* Подключение штатных стилей выбора мира, главы и уровня. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocCampaignPickerStyle) return;

  function install() {
    if (typeof document === "undefined" || document.querySelector('link[data-campaign-picker-styles]')) return false;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles/campaign-picker.css";
    link.dataset.campaignPickerStyles = "1";
    document.head?.appendChild(link);
    return true;
  }

  root.SolivocCampaignPickerStyle = Object.freeze({ install });
  if (typeof document !== "undefined") install();
})();
