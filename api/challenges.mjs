import { randomBytes } from "node:crypto";
import { sendPushToClient } from "./_push-lib.mjs";

const ACTIVE_TTL = 7 * 24 * 60 * 60;
const RESULT_TTL = 7 * 24 * 60 * 60;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

function firstEnv(...names) { for (const name of names) { const value=process.env[name]; if(value) return value; } return ""; }
function redisConfig(){return{url:firstEnv("UPSTASH_REDIS_REST_URL","KV_REST_API_URL","UPSTASH_REDIS_REST_KV_REST_API_URL").replace(/\/$/,""),token:firstEnv("UPSTASH_REDIS_REST_TOKEN","KV_REST_API_TOKEN","UPSTASH_REDIS_REST_KV_REST_API_TOKEN")};}
function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});}
async function redis(command){const{url,token}=redisConfig();if(!url||!token){const e=new Error("Redis is not configured");e.code="REDIS_NOT_CONFIGURED";throw e;}const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw new Error(data.error||`Redis ${response.status}`);return data.result;}
function activeKey(code){return `worditaire:challenge:active:${code}`;}
function resultKey(code){return `worditaire:challenge:result:${code}`;}
function parse(value){if(!value)return null;if(typeof value==="object")return value;try{return JSON.parse(value);}catch{return null;}}
function cleanCode(value){const code=String(value||"").trim().toUpperCase();return CODE_RE.test(code)?code:"";}
function shortCode(){const bytes=randomBytes(6);let code="";for(let i=0;i<6;i++)code+=CODE_ALPHABET[bytes[i]%CODE_ALPHABET.length];return code;}
function token(){return randomBytes(24).toString("base64url");}
function cleanResult(value){return{stars:Math.max(1,Math.min(3,Number(value?.stars)||1)),moves:Math.max(0,Math.min(100000,Number(value?.moves)||0)),hints:Math.max(0,Math.min(10000,Number(value?.hints)||0)),errors:Math.max(0,Math.min(10000,Number(value?.errors)||0)),undos:Math.max(0,Math.min(10000,Number(value?.undos)||0)),playerName:String(value?.playerName||"Игрок").trim().slice(0,20)||"Игрок",completedAt:Date.now()};}
async function setWithExistingTtl(key,record,fallback=RESULT_TTL){let ttl=Number(await redis(["TTL",key]));if(!Number.isFinite(ttl)||ttl<60)ttl=fallback;await redis(["SET",key,JSON.stringify(record),"EX",ttl]);}
function seriesFields(x={}){return{seriesId:String(x.seriesId||"").slice(0,96)||null,seriesRound:Math.max(1,Math.min(99,Number(x.seriesRound)||1)),seriesScoreCreator:Math.max(0,Math.min(9,Number(x.seriesScoreCreator)||0)),seriesScoreGuest:Math.max(0,Math.min(9,Number(x.seriesScoreGuest)||0))};}

export function OPTIONS(){return json({ok:true});}

export async function GET(request){
  try{
    const url=new URL(request.url), code=cleanCode(url.searchParams.get("code")), ownerToken=String(url.searchParams.get("ownerToken")||""), guestToken=String(url.searchParams.get("guestToken")||"");
    if(!code)return json({error:"invalid_code",message:"Неверный код"},400);
    if(ownerToken||guestToken){
      const result=parse(await redis(["GET",resultKey(code)]));
      if(result){
        if(ownerToken&&result.ownerToken!==ownerToken)return json({error:"forbidden"},403);
        if(guestToken&&result.guestToken!==guestToken)return json({error:"forbidden"},403);
        return json({status:"completed",code,guestResult:result.guestResult,creatorResult:result.creatorResult||null,creatorName:result.creatorName,level:result.level,seed:result.seed,...seriesFields(result)});
      }
      if(guestToken)return json({error:"not_found"},404);
      const active=parse(await redis(["GET",activeKey(code)]));
      if(!active)return json({error:"not_found",message:"Вызов истёк или уже получен"},404);
      if(active.ownerToken!==ownerToken)return json({error:"forbidden"},403);
      return json({status:"pending",code,level:active.level,seed:active.seed,expiresAt:active.expiresAt,creatorResult:active.creatorResult||null,...seriesFields(active)});
    }
    const active=parse(await redis(["GET",activeKey(code)]));
    if(!active)return json({error:"used_or_expired",message:"Код уже сыгран или истёк"},410);
    return json({status:"active",code,seed:active.seed,level:active.level,creatorName:active.creatorName||"Игрок",creatorResult:active.creatorResult||null,expiresAt:active.expiresAt,...seriesFields(active)});
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured",message:"Redis не подключён"},503);console.error("challenge GET",error);return json({error:"server_error"},500);}
}

export async function POST(request){
  try{
    const body=await request.json().catch(()=>({}));
    if(body.action==="create"){
      const seed=String(body.seed||"").slice(0,160),level=Math.max(1,Math.min(999,Number(body.level)||25)),creatorName=String(body.creatorName||"Игрок").trim().slice(0,20)||"Игрок",pushClientId=String(body.pushClientId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64),series=seriesFields(body);
      if(!seed)return json({error:"invalid_seed"},400);
      const ownerToken=token(),createdAt=Date.now(),expiresAt=createdAt+ACTIVE_TTL*1000;
      for(let attempt=0;attempt<14;attempt++){
        const code=shortCode(),record={v:3,code,seed,level,creatorName,ownerToken,createdAt,expiresAt,pushClientId,creatorResult:null,...series};
        const stored=await redis(["SET",activeKey(code),JSON.stringify(record),"EX",ACTIVE_TTL,"NX"]);
        if(stored==="OK")return json({ok:true,code,ownerToken,expiresAt,...series});
      }
      return json({error:"code_collision",message:"Не удалось создать код"},503);
    }
    const code=cleanCode(body.code); if(!code)return json({error:"invalid_code"},400);

    if(body.action==="attachPush"){
      const ownerToken=String(body.ownerToken||""),pushClientId=String(body.pushClientId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64),active=parse(await redis(["GET",activeKey(code)]));
      if(!active)return json({error:"not_found"},404);if(active.ownerToken!==ownerToken)return json({error:"forbidden"},403);
      active.pushClientId=pushClientId;await setWithExistingTtl(activeKey(code),active,ACTIVE_TTL);return json({ok:true});
    }

    if(body.action==="ownerResult"){
      const ownerToken=String(body.ownerToken||""),creatorResult=cleanResult(body.result);
      const result=parse(await redis(["GET",resultKey(code)]));
      if(result){
        if(result.ownerToken!==ownerToken)return json({error:"forbidden"},403);
        const firstCreatorResult=!result.creatorResult;
        result.creatorResult=creatorResult;
        await setWithExistingTtl(resultKey(code),result);
        if(firstCreatorResult&&result.guestPushClientId) sendPushToClient(result.guestPushClientId,{title:"Друг сыграл ваш вызов",body:`${creatorResult.playerName}: ${"★".repeat(creatorResult.stars)} · ${creatorResult.moves} ходов`,tag:`challenge-${code}`,url:"/"}).catch(()=>{});
        return json({ok:true,status:"completed"});
      }
      const active=parse(await redis(["GET",activeKey(code)]));
      if(!active)return json({error:"not_found"},404);if(active.ownerToken!==ownerToken)return json({error:"forbidden"},403);
      active.creatorResult=creatorResult;await setWithExistingTtl(activeKey(code),active,ACTIVE_TTL);return json({ok:true,status:"pending"});
    }

    if(body.action==="complete"){
      const submissionId=String(body.submissionId||"").slice(0,96);if(!submissionId)return json({error:"missing_submission_id"},400);
      const existing=parse(await redis(["GET",resultKey(code)]));
      if(existing){if(existing.submissionId===submissionId)return json({ok:true,duplicate:true,guestToken:existing.guestToken,creatorResult:existing.creatorResult||null,...seriesFields(existing)});return json({error:"used_or_expired",message:"Этот вызов уже сыгран"},410);}
      const raw=await redis(["GETDEL",activeKey(code)]),active=parse(raw);if(!active)return json({error:"used_or_expired",message:"Этот вызов уже сыгран или истёк"},410);
      const guestResult=cleanResult(body.result),guestToken=token(),guestPushClientId=String(body.pushClientId||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64),completedAt=Date.now(),record={v:3,code,seed:active.seed,level:active.level,creatorName:active.creatorName,ownerToken:active.ownerToken,guestToken,guestPushClientId,submissionId,guestResult,creatorResult:active.creatorResult||null,ownerAck:false,guestAck:false,completedAt,...seriesFields(active)};
      await redis(["SET",resultKey(code),JSON.stringify(record),"EX",RESULT_TTL]);
      if(active.pushClientId) sendPushToClient(active.pushClientId,{title:"Друг завершил вызов",body:`${guestResult.playerName}: ${"★".repeat(guestResult.stars)} · ${guestResult.moves} ходов`,tag:`challenge-${code}`,url:"/"}).catch(()=>{});
      return json({ok:true,completedAt,guestToken,creatorResult:record.creatorResult,...seriesFields(record)});
    }

    if(body.action==="ack"){
      const ownerToken=String(body.ownerToken||""),guestToken=String(body.guestToken||""),result=parse(await redis(["GET",resultKey(code)]));
      if(!result)return json({ok:true,alreadyDeleted:true});
      if(ownerToken){if(result.ownerToken!==ownerToken)return json({error:"forbidden"},403);result.ownerAck=true;}
      else if(guestToken){if(result.guestToken!==guestToken)return json({error:"forbidden"},403);result.guestAck=true;}
      else return json({error:"forbidden"},403);
      if(result.ownerAck&&result.guestAck&&result.creatorResult){await redis(["DEL",resultKey(code)]);return json({ok:true,deleted:true});}
      await setWithExistingTtl(resultKey(code),result);return json({ok:true});
    }
    return json({error:"unknown_action"},400);
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured",message:"Redis не подключён"},503);console.error("challenge POST",error);return json({error:"server_error"},500);}
}
