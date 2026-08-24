function clone(value) { try { return JSON.parse(JSON.stringify(value)); } catch { return value; } }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function mergeMascotDailySnapshots(localValue, cloudValue) {
  const local = object(localValue), cloud = object(cloudValue);
  const ld = String(local.date || ""), cd = String(cloud.date || "");
  if (ld && cd && ld !== cd) return clone(ld > cd ? local : cloud);
  if (!ld) return clone(cloud);
  if (!cd) return clone(local);

  const quests = {};
  for (const id of new Set([...Object.keys(object(local.quests)), ...Object.keys(object(cloud.quests))])) {
    const a = object(local.quests?.[id]), b = object(cloud.quests?.[id]);
    quests[id] = {
      ...(Object.keys(a).length ? clone(a) : {}),
      ...(Object.keys(b).length ? clone(b) : {}),
      progress: Math.max(0, Number(a.progress) || 0, Number(b.progress) || 0),
      completed: !!a.completed || !!b.completed,
      rewarded: !!a.rewarded || !!b.rewarded,
    };
  }
  const affinityBank = {};
  for (const id of new Set([...Object.keys(object(local.affinityBank)), ...Object.keys(object(cloud.affinityBank))])) {
    affinityBank[id] = Math.max(0, Number(local.affinityBank?.[id]) || 0, Number(cloud.affinityBank?.[id]) || 0);
  }
  return { date:ld || cd, quests, affinityBank };
}
