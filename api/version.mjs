const BUILD = "v31-2026-08-21";

export async function GET() {
  const deployment = process.env.YC_FUNCTION_VERSION_ID
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
