import { pushKey, redis, sendPushToClient } from "./_push-lib.mjs";

const CLIENT_SET = "worditaire:push:clients";
const PUSH_TTL = 60 * 24 * 60 * 60;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
function parse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}
function localParts(now, offsetMinutes) {
  const shifted = new Date(now.getTime() - (Number(offsetMinutes) || 0) * 60000);
  const key = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  return { key, day: shifted.getUTCDay() };
}
async function saveRecord(clientId, record) {
  await redis(["SET", pushKey(clientId), JSON.stringify(record), "EX", PUSH_TTL]);
}
function authorized(request) {
  const secret = process.env.CRON_SECRET || "";
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET) return json({ error: "cron_secret_not_configured" }, 503);
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);
  try {
    const clientIds = (await redis(["SMEMBERS", CLIENT_SET])) || [];
    const now = new Date();
    let sent = 0, checked = 0;
    for (const clientId of clientIds.slice(0, 1000)) {
      const record = parse(await redis(["GET", pushKey(clientId)]));
      if (!record?.subscription) {
        await redis(["SREM", CLIENT_SET, clientId]).catch(() => {});
        continue;
      }
      checked++;
      const local = localParts(now, record.timezoneOffset), dailyMissing = record.preferences?.daily !== false && record.dailyDoneKey !== local.key;
      const weeklyMissing = record.preferences?.weekly !== false && local.day === 0 && !record.weeklyCompleted;
      let payload = null, noticeKind = "";

      if (weeklyMissing && dailyMissing && record.lastWeeklyNotice !== (record.weeklyKey || local.key)) {
        payload = { title: "Финал недели в Словасьянсе", body: "Ежедневный расклад ещё не сыгран, а недельное испытание всё ещё можно закрыть.", tag: "weekly-reminder", url: "/" };
        noticeKind = "weekly";
      } else if (weeklyMissing && record.lastWeeklyNotice !== (record.weeklyKey || local.key)) {
        payload = { title: "Неделя почти закончилась", body: "Недельное испытание ещё можно успеть завершить сегодня.", tag: "weekly-reminder", url: "/" };
        noticeKind = "weekly";
      } else if (dailyMissing && record.lastDailyNotice !== local.key) {
        payload = { title: "Ежедневный расклад ждёт", body: "Один короткий расклад — и серия продолжится.", tag: "daily-reminder", url: "/" };
        noticeKind = "daily";
      }

      if (!payload) continue;
      const ok = await sendPushToClient(clientId, payload);
      if (!ok) continue;
      sent++;
      if (noticeKind === "weekly") record.lastWeeklyNotice = record.weeklyKey || local.key;
      if (noticeKind === "daily") record.lastDailyNotice = local.key;
      record.updatedAt = Date.now();
      await saveRecord(clientId, record);
    }
    return json({ ok: true, checked, sent });
  } catch (error) {
    console.error("reminders", error);
    return json({ error: error?.message === "REDIS_NOT_CONFIGURED" ? "redis_not_configured" : "server_error" }, 500);
  }
}
