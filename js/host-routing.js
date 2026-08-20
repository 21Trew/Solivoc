/* Host-level compatibility for static hosting without Vercel rewrites. */
(() => {
  if (typeof location === "undefined") return;
  if (location.hostname === "admin.solivoc.ru" && (location.pathname === "/" || location.pathname === "")) {
    location.replace("/admin.html");
  }
})();
