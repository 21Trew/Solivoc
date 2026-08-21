import webpush from "web-push";

function legacyVercelRuntime() {
  return !!process.env.VERCEL;
}
function firstEnv(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return "";
}
function redisConfig() {
  if (legacyVercelRuntime()) return { url: "", token: "" };
  return {
    url: firstEnv("UPSTASH_REDIS_REST_URL","KV_REST_API_URL","UPSTASH_REDIS_REST_KV_REST_API_URL").replace(/\/$/,""),
    token: firstEnv("UPSTASH_REDIS_REST_TOKEN","KV_REST_API_TOKEN","UPSTASH_REDIS_REST_KV_REST_API_TOKEN"),
  };
}
export async function redis(command) {
  const {url,token}=redisConfig();
  if(!url||!token) throw new Error("REDIS_NOT_CONFIGURED");
  const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error) throw new Error(data.error||`Redis ${response.status}`);
  return data.result;
}
export function pushKey(clientId){return `worditaire:push:${String(clientId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64)}`;}
export function configureWebPush(){
  if(legacyVercelRuntime()) return false;
  const publicKey=process.env.VAPID_PUBLIC_KEY||"", privateKey=process.env.VAPID_PRIVATE_KEY||"", subject=process.env.VAPID_SUBJECT||"mailto:admin@solivoc.app";
  if(!publicKey||!privateKey) return false;
  webpush.setVapidDetails(subject,publicKey,privateKey);
  return true;
}
export async function sendPushToClient(clientId,payload){
  if(!clientId||!configureWebPush()) return false;
  const recordRaw=await redis(["GET",pushKey(clientId)]), record=recordRaw?JSON.parse(recordRaw):null;
  if(!record?.subscription) return false;
  try{
    await webpush.sendNotification(record.subscription,JSON.stringify(payload),{TTL:3600,urgency:"normal"});
    return true;
  }catch(err){
    if(err?.statusCode===404||err?.statusCode===410){
      await redis(["DEL",pushKey(clientId)]).catch(()=>{});
      await redis(["SREM","worditaire:push:clients",clientId]).catch(()=>{});
    }
    console.warn("push send",err?.statusCode||err?.message||err);
    return false;
  }
}
