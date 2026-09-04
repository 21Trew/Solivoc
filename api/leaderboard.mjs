import { checkRateLimit, currentSession, readCloudProfile, sameOrigin } from "./_auth-lib.mjs";
import { canonicalProfileNeedsNormalization, normalizeCanonicalProfile } from "./_canonical-profile-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { LEADERBOARD_BOARDS, syncLeaderboardProjection } from "./_leaderboard-projection-lib.mjs";
import { redis } from "./_push-lib.mjs";

const BOARDS = new Set(LEADERBOARD_BOARDS);
function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});}
function cleanId(value){return String(value||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);}
function playerKey(id){return `worditaire:leaderboard:player:${id}`;}
function boardKey(id){return `worditaire:leaderboard:v1:${id}`;}
function num(value,max=1e12){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;}
function cleanValues(v={}){return{
  stars:Math.floor(num(v.stars,1e7)), levels:Math.floor(num(v.levels,1e7)), daily:Math.floor(num(v.daily,1e7)),
  marathon:Math.floor(num(v.marathon,1e7)), zen:Math.floor(num(v.zen,1e7)), combo:Math.floor(num(v.combo,1e7)), duel:Math.floor(num(v.duel,1e7)), pictures:Math.floor(num(v.pictures,1e7)),
  time:Math.floor(num(v.time,86400000)), moves:Math.floor(num(v.moves,100000)), noMistakes:Math.floor(num(v.noMistakes,1e7)), onePass:Math.floor(num(v.onePass,1e7)), hardcore:Math.floor(num(v.hardcore,1e7)),
};}
function cleanDuelStats(v={}){return{matches:Math.floor(num(v.matches,1e7)),wins:Math.floor(num(v.wins,1e7)),losses:Math.floor(num(v.losses,1e7)),draws:Math.floor(num(v.draws,1e7)),gold:Math.floor(num(v.gold,1e7)),silver:Math.floor(num(v.silver,1e7)),bronze:Math.floor(num(v.bronze,1e7)),xp:Math.floor(num(v.xp,1e8)),rating:Math.floor(num(v.rating,1e8))};}
function fingerprint(rec={}){return `${String(rec.name||"Игрок").trim().toLowerCase()}|${String(rec.avatar||"🙂")}`;}

async function canonicalProfile(userId) {
  const profile = await readCloudProfile(userId);
  if (!profile) return null;
  if (!canonicalProfileNeedsNormalization(profile)) return profile;
  const normalized = await mutateCloudProfileAtomic(userId, ({ current }) => normalizeCanonicalProfile(current));
  return normalized.profile;
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
    entries.push({rank:entries.length+1,playerId:id,name:String(rec.name||"Игрок").slice(0,20),avatar:String(rec.avatar||"🙂").slice(0,8),value});
  }
  if(remove.length)await redis(["ZREM",key,...remove]).catch(()=>{});
  return entries;
}

export function OPTIONS(){return json({ok:true});}

export async function POST(request){
  try{
    if(!sameOrigin(request))return json({error:"forbidden_origin"},403);
    if(!(await checkRateLimit(request,"leaderboard-project",120,900)))return json({error:"rate_limited"},429);
    const session=await currentSession(request);
    if(!session)return json({error:"unauthorized",message:"Для попадания в лидеры нужен аккаунт"},401);
    const playerId=cleanId(session.userId);
    if(!playerId)return json({error:"invalid_player"},400);

    // Client payload is intentionally ignored. The leaderboard is a derived
    // projection of the canonical server profile and can never be a source of truth.
    const profile=await canonicalProfile(playerId);
    if(!profile)return json({error:"profile_not_found"},404);
    const record=await syncLeaderboardProjection(playerId,profile,session.user);
    return json({ok:true,projection:true,values:cleanValues(record?.values),duelStats:cleanDuelStats(record?.duelStats)});
  }catch(error){
    if(error?.code==="REDIS_NOT_CONFIGURED"||error?.message==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);
    if(["profile_busy","profile_lock_lost"].includes(error?.message)||["profile_busy","profile_lock_lost"].includes(error?.code))return json({error:error?.code||error?.message,retryable:true},409);
    console.error("leaderboard POST",error);return json({error:"server_error"},500);
  }
}

export async function GET(request){
  try{
    if(!(await checkRateLimit(request,"leaderboard-read",300,900)))return json({error:"rate_limited"},429);
    const url=new URL(request.url),requested=String(url.searchParams.get("board")||"stars");
    const session=await currentSession(request).catch(()=>null);
    if(session?.userId){
      try{
        const profile=await canonicalProfile(cleanId(session.userId));
        if(profile)await syncLeaderboardProjection(session.userId,profile,session.user);
      }catch{}
    }
    if(requested==="all"){
      const pairs=await Promise.all(LEADERBOARD_BOARDS.map(async(board)=>[board,await readBoard(board)]));
      let me=null;
      if(session?.userId){try{const raw=await redis(["GET",playerKey(cleanId(session.userId))]);const rec=raw?JSON.parse(raw):null;if(rec)me={values:cleanValues(rec.values),duelStats:cleanDuelStats(rec.duelStats)};}catch{}}
      return json({ok:true,boards:Object.fromEntries(pairs),me});
    }
    if(!BOARDS.has(requested))return json({error:"invalid_board"},400);
    return json({ok:true,board:requested,entries:await readBoard(requested)});
  }catch(error){
    if(error?.code==="REDIS_NOT_CONFIGURED"||error?.message==="REDIS_NOT_CONFIGURED")return json({error:"redis_not_configured"},503);
    console.error("leaderboard GET",error);return json({error:"server_error"},500);
  }
}
