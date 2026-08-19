import { timingSafeEqual } from "node:crypto";
import { redis } from "./_push-lib.mjs";

const BOARDS=["stars","levels","daily","marathon","combo","duel","time","moves","onePass"];
const CHAPTER_SIZE=10;
const clamp=(v,min=0,max=1e9)=>Math.max(min,Math.min(max,Number(v)||0));
const json=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
const parse=(raw)=>{try{return raw?JSON.parse(raw):null}catch{return null}};
const playerKey=(id)=>`worditaire:leaderboard:player:${id}`;
const profileVersionKey=(id)=>`worditaire:auth:profile-version:${id}`;
const boardKey=(id)=>`worditaire:leaderboard:v1:${id}`;
function authorized(request){
  const expected=String(process.env.ADMIN_SECRET||"");
  const actual=String(request.headers.get("x-admin-key")||"");
  if(!expected||!actual||expected.length!==actual.length)return false;
  try{return timingSafeEqual(Buffer.from(expected),Buffer.from(actual));}catch{return false;}
}
async function scanKeys(pattern,limit=5000){
  let cursor="0",out=[];
  do{
    const result=await redis(["SCAN",cursor,"MATCH",pattern,"COUNT",200]);
    cursor=String(result?.[0]??"0");
    const keys=Array.isArray(result?.[1])?result[1]:[];
    out.push(...keys);
    if(out.length>=limit)break;
  }while(cursor!=="0");
  return out.slice(0,limit);
}
async function getMany(keys,batch=80){
  const out=[];
  for(let i=0;i<keys.length;i+=batch){
    const part=keys.slice(i,i+batch),values=part.length?await redis(["MGET",...part]):[];
    for(let j=0;j<part.length;j++)out.push({key:part[j],raw:values?.[j]||null});
  }
  return out;
}
function scoreFor(board,value){if(board==="time")return value>0?1_000_000_000-value:0;if(board==="moves")return value>0?1_000_000-value:0;return value;}
function cleanLeaderboardValues(v={}){return{
  stars:Math.floor(clamp(v.stars,0,1e7)),levels:Math.floor(clamp(v.levels,0,1e7)),daily:Math.floor(clamp(v.daily,0,1e7)),marathon:Math.floor(clamp(v.marathon,0,1e7)),combo:Math.floor(clamp(v.combo,0,1e7)),duel:Math.floor(clamp(v.duel,0,1e8)),time:Math.floor(clamp(v.time,0,86400000)),moves:Math.floor(clamp(v.moves,0,100000)),onePass:Math.floor(clamp(v.onePass,0,1e7)),
};}
function repairCampaign(profile={}, progressFloor=0, starFloor=0){
  const stars={};
  const previousTotal=Math.max(0,Number(profile.totalStars)||0,Number(starFloor)||0);
  for(const [k,v] of Object.entries(profile.starsByLevel||{})){
    const level=Math.trunc(Number(k)),value=Math.trunc(Number(v));
    if(level>=1&&level<=10000&&value>=1)stars[level]=Math.max(1,Math.min(3,value));
  }
  const records=new Set(Object.entries(profile.levelRecords||{}).filter(([k,r])=>Number(k)>=1&&(Number(r?.stars)>0||Number(r?.moves)>0)).map(([k])=>Math.trunc(Number(k))).filter(Number.isFinite));
  const rawCurrent=Math.max(1,Math.trunc(Number(profile.currentLevel)||1)),storedCompleted=Math.max(0,Math.trunc(Number(profile.stats?.levelsCompleted)||0)),storedFinals=Math.max(0,Math.trunc(Number(profile.stats?.chapterFinalsCompleted)||0));
  let syntheticTailRemoved=false,credibleThrough=storedFinals*CHAPTER_SIZE;
  while(records.has(credibleThrough+1))credibleThrough++;
  if(profile.legacyStarsMigrated&&credibleThrough>=CHAPTER_SIZE&&rawCurrent-1>credibleThrough+CHAPTER_SIZE*3){
    const tail=Object.keys(stars).map(Number).filter(level=>level>credibleThrough);
    if(tail.length>=CHAPTER_SIZE*2&&tail.every(level=>stars[level]===1)){for(const level of tail)delete stars[level];syntheticTailRemoved=true;}
  }
  let contiguous=0;while(stars[contiguous+1])contiguous++;
  const highestStar=Math.max(0,...Object.keys(stars).map(Number).filter(Number.isFinite));
  const highestRecord=Math.max(0,...records);
  const versionedFloor=!syntheticTailRemoved&&Number(profile.campaignProgressVersion||0)>=2?Math.max(storedCompleted,rawCurrent-1):0;
  let completed=Math.max(contiguous,highestStar,highestRecord,versionedFloor,Number(profile.campaignProgressFloor)||0,Number(progressFloor)||0);
  completed=Math.min(10000,Math.max(0,Math.trunc(completed)));
  const hadMissing=completed>Object.keys(stars).length;
  if(completed>contiguous){for(let i=1;i<=completed;i++)if(!stars[i])stars[i]=1;}
  for(const k of Object.keys(stars))if(Number(k)>completed)delete stars[k];
  if(hadMissing&&completed>0){let running=Object.values(stars).reduce((a,b)=>a+Math.max(1,Math.min(3,Number(b)||1)),0);const target=Math.min(completed*3,Math.max(running,previousTotal));for(let i=1;i<=completed&&running<target;i++){const room=3-(Number(stars[i])||1);if(room<=0)continue;const add=Math.min(room,target-running);stars[i]+=add;running+=add;}}
  const campaignStars=Math.min(completed*3,Object.values(stars).reduce((a,b)=>a+Math.max(0,Math.min(3,Number(b)||0)),0));
  const stats={...(profile.stats||{})};
  stats.levelsCompleted=completed;
  stats.chapterFinalsCompleted=Math.floor(completed/CHAPTER_SIZE);
  stats.tripleStarWins=Object.values(stars).filter(v=>Number(v)===3).length;
  profile.starsByLevel=stars;profile.currentLevel=completed+1;profile.totalStars=campaignStars;profile.stats=stats;profile.campaignProgressVersion=Math.max(2,Number(profile.campaignProgressVersion)||0);
  profile.cosmeticStarsPeak=Math.max(Number(profile.cosmeticStarsPeak)||0,campaignStars+(Number(profile.dailyStarTotal)||0));
  return {profile,completed,stars:campaignStars};
}
function duelOutcome(me,friend){
  if(!me||!friend)return 0;
  const mode=String(me.duelMode||friend.duelMode||"classic");
  const score=(r)=>{if(mode==="time")return +r.durationMs||Infinity;if(mode==="combo")return -(+r.maxCombo||0);if(mode==="moves")return +r.moves||0;if(mode==="noMistakes")return r.failed?Infinity:(+r.moves||0)+(+r.durationMs||0)/1e9;return (+r.moves||0)+(+r.errors||0)*2+(+r.hints||0)*5+(+r.undos||0)*3;};
  const a=score(me),b=score(friend);if(a!==b)return a<b?1:-1;
  const ties=mode==="combo"?[[+me.moves||0,+friend.moves||0,false],[+me.durationMs||0,+friend.durationMs||0,false]]:[[+me.errors||0,+friend.errors||0,false],[+me.hints||0,+friend.hints||0,false],[+me.undos||0,+friend.undos||0,false],[+me.stars||0,+friend.stars||0,true],[+me.moves||0,+friend.moves||0,false]];
  for(const [x,y,higher] of ties){if(x===y)continue;return higher?(x>y?1:-1):(x<y?1:-1);}return 0;
}
async function recentDuelStats(){
  const keys=await scanKeys("worditaire:challenge:result:*",5000),rows=await getMany(keys),map=new Map();
  const add=(id,outcome)=>{if(!id)return;const s=map.get(id)||{matches:0,wins:0,losses:0,draws:0};s.matches++;if(outcome>0)s.wins++;else if(outcome<0)s.losses++;else s.draws++;map.set(id,s);};
  for(const row of rows){const r=parse(row.raw);if(!r?.creatorResult||!r?.guestResult)continue;const o=duelOutcome(r.creatorResult,r.guestResult);add(r.creatorResult.playerId||r.creatorPlayerId,o);add(r.guestResult.playerId,-o);}
  return map;
}
function fingerprint(rec={}){return `${String(rec.name||"Игрок").trim().toLowerCase()}|${String(rec.avatar||"🙂")}`;}
async function leaderboardRecords(){
  const keys=await scanKeys("worditaire:leaderboard:player:*",5000),rows=await getMany(keys),records=[];
  for(const row of rows){const rec=parse(row.raw);if(rec)records.push({key:row.key,id:row.key.split(":").at(-1),rec});}
  return records;
}
async function dedupeLeaderboard(records=null){
  const rows=records||await leaderboardRecords(),remove=new Set(),byAccount=new Map();
  for(const row of rows){const a=String(row.rec.accountKey||"");if(!a)continue;const current=byAccount.get(a);if(!current)byAccount.set(a,row);else{const best=(+current.rec.updatedAt||0)>=(+row.rec.updatedAt||0)?current:row;const loser=best===current?row:current;remove.add(loser.id);byAccount.set(a,best);}}
  const accountFp=new Set(rows.filter(r=>r.rec.accountKey&&!remove.has(r.id)).map(r=>fingerprint(r.rec)));
  for(const row of rows)if(!row.rec.accountKey&&accountFp.has(fingerprint(row.rec)))remove.add(row.id);
  for(const id of remove){await redis(["DEL",playerKey(id)]).catch(()=>{});for(const b of BOARDS)await redis(["ZREM",boardKey(b),id]).catch(()=>{});}
  return remove.size;
}
async function repairAll(){
  const [profileKeys,lbRecords,duels]=await Promise.all([scanKeys("worditaire:auth:profile:*",5000),leaderboardRecords(),recentDuelStats()]);
  const profileRows=await getMany(profileKeys),lbMap=new Map(lbRecords.map(x=>[x.id,x.rec]));let repaired=0,starsChanged=0,levelsChanged=0,duelsMerged=0;
  const players=[];
  for(const row of profileRows){
    const userId=row.key.split(":").at(-1),raw=parse(row.raw);if(!raw)continue;
    const oldStars=Number(raw.totalStars)||0,oldLevels=Number(raw.stats?.levelsCompleted)||0;
    const lb=lbMap.get(userId)||{},recent=duels.get(userId)||{};
    const fixed=repairCampaign(raw,+lb.values?.levels||0,+lb.values?.stars||0),profile=fixed.profile,stats=profile.stats||{};
    profile.campaignProgressFloor=Math.max(+profile.campaignProgressFloor||0,fixed.completed,+lb.values?.levels||0);
    const storedDuel=lb.duelStats||{};
    stats.duelMatches=Math.max(+stats.duelMatches||0,+storedDuel.matches||0,+recent.matches||0);
    stats.duelWins=Math.max(+stats.duelWins||0,+storedDuel.wins||0,+recent.wins||0);
    stats.duelLosses=Math.max(+stats.duelLosses||0,+storedDuel.losses||0,+recent.losses||0);
    stats.duelDraws=Math.max(+stats.duelDraws||0,+storedDuel.draws||0,+recent.draws||0);
    stats.duelGold=Math.max(+stats.duelGold||0,+storedDuel.gold||0,stats.duelWins);
    stats.duelSilver=Math.max(+stats.duelSilver||0,+storedDuel.silver||0,stats.duelDraws);
    stats.duelBronze=Math.max(+stats.duelBronze||0,+storedDuel.bronze||0,stats.duelLosses);
    stats.duelXp=Math.max(+stats.duelXp||0,+storedDuel.xp||0,stats.duelGold*4+stats.duelSilver*3+stats.duelBronze*2);
    stats.duelRating=Math.max(+stats.duelRating||0,+storedDuel.rating||0,+lb.values?.duel||0,stats.duelGold*3+stats.duelSilver*2+stats.duelBronze);
    profile.stats=stats;
    if((recent.matches||0)>0)duelsMerged++;
    await redis(["SET",row.key,JSON.stringify(profile)]);
    await redis(["INCR",profileVersionKey(userId)]).catch(()=>{});
    const values=cleanLeaderboardValues({...lb.values,stars:fixed.stars,levels:fixed.completed,daily:stats.dailyCompleted||0,marathon:stats.bestMarathon||0,combo:Math.max(stats.maxCombo||0,stats.maxDragCombo||0),duel:stats.duelRating||0,onePass:profile.modeStats?.onePass?.completed||0,time:profile.modeStats?.time?.bestTimeMs||0,moves:profile.modeStats?.moves?.bestMoves||0});
    const duelStats={matches:stats.duelMatches||0,wins:stats.duelWins||0,losses:stats.duelLosses||0,draws:stats.duelDraws||0,gold:stats.duelGold||0,silver:stats.duelSilver||0,bronze:stats.duelBronze||0,xp:stats.duelXp||0,rating:stats.duelRating||0};
    const record={...lb,playerId:userId,name:String(profile.playerName||lb.name||"Игрок").slice(0,20),avatar:String(profile.avatarEmoji||lb.avatar||"🙂").slice(0,8),values,duelStats,account:true,updatedAt:Date.now()};
    await redis(["SET",playerKey(userId),JSON.stringify(record),"EX",90*24*60*60]);
    for(const board of BOARDS){const value=values[board];if(value>0)await redis(["ZADD",boardKey(board),scoreFor(board,value),userId]);}
    repaired++;if(oldStars!==fixed.stars)starsChanged++;if(oldLevels!==fixed.completed)levelsChanged++;
    players.push({id:userId,name:record.name,levels:fixed.completed,stars:fixed.stars,duels:duelStats.matches,rating:duelStats.rating});
  }
  const deduped=await dedupeLeaderboard(await leaderboardRecords());
  return {repaired,starsChanged,levelsChanged,duelsMerged,deduped,players:players.sort((a,b)=>b.stars-a.stars).slice(0,300)};
}
async function summary(){
  const [profiles,records]=await Promise.all([scanKeys("worditaire:auth:profile:*",5000),leaderboardRecords()]);
  return {profiles:profiles.length,leaderboardRecords:records.length,adminConfigured:!!process.env.ADMIN_SECRET,players:records.map(x=>({id:x.id,name:String(x.rec.name||"Игрок"),levels:+x.rec.values?.levels||0,stars:+x.rec.values?.stars||0,duel:+x.rec.values?.duel||0,account:!!x.rec.accountKey})).sort((a,b)=>b.stars-a.stars).slice(0,300)};
}
export function OPTIONS(){return json({ok:true});}
export async function GET(request){if(!authorized(request))return json({error:"unauthorized"},401);try{return json({ok:true,...await summary()});}catch(error){console.error("admin GET",error);return json({error:"server_error",message:String(error?.message||error)},500);}}
export async function POST(request){if(!authorized(request))return json({error:"unauthorized"},401);try{const body=await request.json().catch(()=>({}));if(body.action==="repair_all")return json({ok:true,...await repairAll()});if(body.action==="dedupe")return json({ok:true,deduped:await dedupeLeaderboard()});return json({error:"unknown_action"},400);}catch(error){console.error("admin POST",error);return json({error:"server_error",message:String(error?.message||error)},500);}}
