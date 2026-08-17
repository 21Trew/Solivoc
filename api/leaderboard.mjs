import { currentSession } from "./_auth-lib.mjs";
const BOARDS = new Set(["stars","levels","daily","marathon","combo","duel","time","moves","onePass"]);
function firstEnv(...names){for(const name of names){const value=process.env[name];if(value)return value;}return "";}
function redisConfig(){return{url:firstEnv("UPSTASH_REDIS_REST_URL","KV_REST_API_URL","UPSTASH_REDIS_REST_KV_REST_API_URL").replace(/\/$/,""),token:firstEnv("UPSTASH_REDIS_REST_TOKEN","KV_REST_API_TOKEN","UPSTASH_REDIS_REST_KV_REST_API_TOKEN")};}
function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});}
async function redis(command){const{url,token}=redisConfig();if(!url||!token){const e=new Error("Redis is not configured");e.code="REDIS_NOT_CONFIGURED";throw e;}const response=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(command),cache:"no-store"});const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw new Error(data.error||`Redis ${response.status}`);return data.result;}
function cleanId(value){return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);}
function cleanName(value){return String(value||"Игрок").trim().slice(0,20)||"Игрок";}
function cleanAvatar(value){return String(value||"🙂").slice(0,8)||"🙂";}
function boardKey(id){return `worditaire:leaderboard:v1:${id}`;}
function playerKey(id){return `worditaire:leaderboard:player:${id}`;}
function num(value,max=1e12){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;}
function cleanValues(v={}){return{
  stars:Math.floor(num(v.stars,1e7)), levels:Math.floor(num(v.levels,1e7)), daily:Math.floor(num(v.daily,1e7)),
  marathon:Math.floor(num(v.marathon,1e7)), combo:Math.floor(num(v.combo,1e7)), duel:Math.floor(num(v.duel,1e7)),
  time:Math.floor(num(v.time,86400000)), moves:Math.floor(num(v.moves,100000)), onePass:Math.floor(num(v.onePass,1e7)),
};}
function scoreFor(board,value){if(board==="time")return value>0?1_000_000_000-value:0;if(board==="moves")return value>0?1_000_000-value:0;return value;}
export function OPTIONS(){return json({ok:true});}
export async function POST(request){
  try{
    const session=await currentSession(request);if(!session)return json({error:"unauthorized",message:"Для попадания в лидеры нужен аккаунт"},401);
    const body=await request.json().catch(()=>({})),playerId=cleanId(session.userId);if(!playerId)return json({error:"invalid_player"},400);
    const values=cleanValues(body.values),record={playerId,name:cleanName(body.name),avatar:cleanAvatar(body.avatar),values,account:true,updatedAt:Date.now()};
    await redis(["SET",playerKey(playerId),JSON.stringify(record),"EX",90*24*60*60]);
    for(const board of BOARDS){const value=values[board];if(value>0)await redis(["ZADD",boardKey(board),scoreFor(board,value),playerId]);}
    return json({ok:true});
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED"||error?.message==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);console.error("leaderboard POST",error);return json({error:"server_error"},500);}
}
export async function GET(request){
  try{
    const url=new URL(request.url),board=String(url.searchParams.get("board")||"stars");if(!BOARDS.has(board))return json({error:"invalid_board"},400);
    const raw=await redis(["ZREVRANGE",boardKey(board),0,49]);const ids=Array.isArray(raw)?raw:[];if(!ids.length)return json({ok:true,board,entries:[]});
    const records=await redis(["MGET",...ids.map(playerKey)]);const entries=[];
    for(let i=0;i<ids.length;i++){let rec=null;try{rec=records?.[i]?JSON.parse(records[i]):null;}catch{}if(!rec)continue;const value=cleanValues(rec.values)[board];if(!value)continue;entries.push({rank:entries.length+1,playerId:ids[i],name:cleanName(rec.name),avatar:cleanAvatar(rec.avatar),value});}
    return json({ok:true,board,entries});
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);console.error("leaderboard GET",error);return json({error:"server_error"},500);}
}
