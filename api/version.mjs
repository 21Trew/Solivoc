const BUILD = "v24-2026-08-18";

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.status(200).json({ build: BUILD });
}
