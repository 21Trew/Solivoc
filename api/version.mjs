const BUILD = "v28-2026-08-19";

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  const deployment = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || BUILD;
  res.status(200).json({ build: BUILD, deployment });
}
