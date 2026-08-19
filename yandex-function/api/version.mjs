const BUILD = "v29-2026-08-19";

export async function GET() {
  const deployment = process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.VERCEL_DEPLOYMENT_ID
    || process.env.YC_FUNCTION_VERSION_ID
    || process.env.FUNCTION_VERSION_ID
    || BUILD;
  return Response.json({ build: BUILD, deployment }, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
    },
  });
}
