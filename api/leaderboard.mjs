import { createHash } from "node:crypto";
import { checkRateLimit, currentSession, readCloudProfile, sameOrigin } from "./_auth-lib.mjs";
import { applyCampaignFloor, profileBehindCampaignFloor } from "./_campaign-floor-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { redis, redisPipeline } from "./_push-lib.mjs";

const BOARD_LIST = Object.freeze(["stars","levels","daily","marathon","zen","combo","duel","pictures","time","moves","noMistakes","onePass","hardcore"]);
const BOARDS = new Set(BOARD_LIST);
const LEADERBOARD_MAX_MEMBERS = 2000, LEADERBOARD_TTL = 180 * 24 * 60 * 60;
function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});}
function cleanId(value){return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);}
function cleanName(value){return String(value||"Игрок").trim().slice(0,20)||"Игрок";}
function cleanAvatar(value){return String(value||"🙂").slice(0,8)||"🙂";}
function boardKey(id){return `worditaire:leaderboard:v1:${id}`;}
function playerKey(id){return `worditaire:leaderboard:player:${id}`;}
function num(value,max=1e12){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;}
function cleanValues(v={}){return{
  stars:Math.floor(num(v.stars,1e7)), levels:Math.floor(num(v.levels,1e7)), daily:Math.floor(num(v.daily,1e7)),
  marathon:Math.floor(num(v.marathon,1e7)), zen:Math.floor(num(v.zen,1e7)), combo:Math.floor(num(v.combo,1e7)), duel:Math.floor(num(v.duel,1e7)), pictures:Math.floor(num(v.pictures,1e7)),
  time:Math.floor(num(v.time,86400000)), moves:Math.floor(num(v.moves,100000)), noMistakes:Math.floor(num(v.noMistakes,1e7)), onePass:Math.floor(num(v.onePass,1e7)), hardcore:Math.floor(num(v.hardcore,1e7)),
};}
function scoreFor(board,value){if(board==="time")return value>0?1_000_000_000-value:0;if(board==="moves")return value>0?1_000_000-value:0;return value;}
function accountKeyFor(session){const email=String(session?.user?.email||"").trim().toLowerCase();return email?createHash("sha256").update(`solivoc-leaderboard:${email}`).digest("hex").slice(0,32):"";}
function fingerprint(rec={}){return `${cleanName(rec.name).toLowerCase()}|${cleanAvatar(rec.avatar)}`;}
function cleanDuelStats(v={}){return{matches:Math.floor(num(v.matches,1e7)),wins:Math.floor(num(v.wins,1e7)),losses:Math.floor(num(v.losses,1e7)),draws:Math.floor(num(v.draws,1e7)),gold:Math.floor(num(v.gold,1e7)),silver:Math.floor(num(v.silver,1e7)),bronze:Math.floor(num(v.bronze,1e7)),xp:Math.floor(num(v.xp,1e8)),rating:Math.floor(num(v.rating,1e8))};}

async function syncCampaignFloor(userId, values) {
  const floor = { levels: Number(values?.levels) || 0, stars: Number(values?.stars) || 0 };
  if (!floor.levels && !floor.stars) return false;
  const existing = await readCloudProfile(userId).catch(() => null);
  if (!existing || !profileBehindCampaignFloor(existing, floor)) return false;
  await mutateCloudProfileAtomic(userId, ({ current }) => {
    if (!current || !profileBehindCampaignFloor(current, floor)) return current;
    return applyCampaignFloor({ ...current }, floor);
  });
  return true;
}

async function readBoard(board){
  const key=boardKey(board),raw=await redis(["ZREVRANGE",key,0,149]),ids=Array.isArray(raw)?raw:[];
  if(!ids.length)return [];
  const records=await redis(["MGET",...ids.map(playerKey)]),parsed=[];
  for(let i=0;i<ids.length;i++){let rec=null;try{rec=records?.[i]?JSON.parse(records[i]):null;}catch{} parsed.push({id:ids[i],rec});}
  const accountFingerprints=new Set(parsed.filter(x=>x.rec?.accountKey).map(x=>fingerprint(x.rec))), entries=[],remove=[],seenAccounts=new Set(),seenLegacyFingerprints=new Set();
  for(const {id,rec} of parsed){
    if(entries.length>=50)break;
    if(!rec){remove.push(id);continue;}
    const accountKey=String(rec.accountKey||""),fp=fingerprint(rec);
    if(accountKey&&seenAccounts.has(accountKey)){remove.push(id);continue;}
    if(!accountKey&&accountFingerprints.has(fp)){remove.push(id);continue;}
    if(!accountKey&&seenLegacyFingerprints.has(fp)){remove.push(id);continue;}
    if(accountKey)seenAccounts.add(accountKey);else seenLegacyFingerprints.add(fp);
    const value=cleanValues(rec.values)[board];if(!value)continue;
    entries.push({rank:entries.length+1,playerId:id,name:cleanName(rec.name),avatar:cleanAvatar(rec.avatar),value});
  }
  if(remove.length)await redis(["ZREM",key,...remove]).catch(()=>{});
  return entries;
}

export function OPTIONS(){return json({ok:true});}
export async function POST(request){
  try{
    if(!sameOrigin(request))return json({error:"forbidden_origin"},403);
    if(!(await checkRateLimit(request,"leaderboard-write",60,900)))return json({error:"rate_limited"},429);
    const session=await currentSession(request);if(!session)return json({error:"unauthorized",message:"Для попадания в лидеры нужен аккаунт"},401);
    const body=await request.json().catch(()=>({})),playerId=cleanId(session.userId);if(!playerId)return json({error:"invalid_player"},400);
    const values=cleanValues(body.values),duelStats=cleanDuelStats(body.duelStats),record={playerId,name:cleanName(body.name),avatar:cleanAvatar(body.avatar),values,duelStats,account:true,accountKey:accountKeyFor(session),updatedAt:Date.now()};
    await syncCampaignFloor(playerId, values);
    const commands=[["SET",playerKey(playerId),JSON.stringify(record),"EX",90*24*60*60]];
    for(const board of BOARD_LIST){
      const value=values[board];if(value<=0)continue;const key=boardKey(board);
      commands.push(
        ["ZADD",key,scoreFor(board,value),playerId],
        ["ZREMRANGEBYRANK",key,0,-(LEADERBOARD_MAX_MEMBERS+1)],
        ["EXPIRE",key,LEADERBOARD_TTL],
      );
    }
    await redisPipeline(commands);
    return json({ok:true});
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED"||error?.message==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);console.error("leaderboard POST",error);return json({error:"server_error"},500);}
}
export async function GET(request){
  try{
    if(!(await checkRateLimit(request,"leaderboard-read",300,900)))return json({error:"rate_limited"},429);
    const url=new URL(request.url),requested=String(url.searchParams.get("board")||"stars");
    if(requested==="all"){
      const pairs=await Promise.all(BOARD_LIST.map(async(board)=>[board,await readBoard(board)]));
      const session=await currentSession(request).catch(()=>null);let me=null;
      if(session?.userId){try{const raw=await redis(["GET",playerKey(cleanId(session.userId))]);const rec=raw?JSON.parse(raw):null;if(rec)me={values:cleanValues(rec.values),duelStats:cleanDuelStats(rec.duelStats)};}catch{}}
      return json({ok:true,boards:Object.fromEntries(pairs),me});
    }
    if(!BOARDS.has(requested))return json({error:"invalid_board"},400);
    return json({ok:true,board:requested,entries:await readBoard(requested)});
  }catch(error){if(error?.code==="REDIS_NOT_CONFIGURED"||error?.message==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);console.error("leaderboard GET",error);return json({error:"server_error"},500);}
}
