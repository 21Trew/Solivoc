function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
function htmlResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      ...headers,
    },
  });
}

export async function GET(request) {
  const url = new URL(request.url), code = cleanCode(url.searchParams.get("c"));
  const origin = url.origin;
  if (code.length !== 6) return Response.redirect(`${origin}/`, 302);
  const target = `${origin}/?c=${encodeURIComponent(code)}`;
  const image = `${origin}/icons/share-duel.png`;
  return htmlResponse(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Дуэль ${code} — Словасьянс</title>
<meta name="description" content="Тебя пригласили в дуэль Словасьянса. Открой тот же расклад и сравни результат.">
<meta property="og:type" content="website">
<meta property="og:title" content="Словасьянс — дуэль ${code}">
<meta property="og:description" content="Тебя пригласили в дуэль. Собери тот же расклад и сравни результат с другом.">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${origin}/d/${code}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Словасьянс — дуэль ${code}">
<meta name="twitter:description" content="Открой тот же расклад и сравни результат с другом.">
<meta name="twitter:image" content="${image}">
<meta http-equiv="refresh" content="0;url=${target}">
<style>html{font-family:system-ui,sans-serif;background:#17133f;color:#fff}body{min-height:100vh;display:grid;place-items:center;margin:0;padding:24px;text-align:center}a{display:inline-block;margin-top:16px;padding:14px 20px;border-radius:14px;background:#6478ff;color:#fff;text-decoration:none;font-weight:800}</style>
</head>
<body><main><h1>Дуэль ${code}</h1><p>Открываем Словасьянс…</p><a href="${target}">Играть →</a></main></body>
</html>`);
}
