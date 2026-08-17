import { redis } from "./_push-lib.mjs";
import { checkRateLimit, sameOrigin } from "./_auth-lib.mjs";

function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0"}});}
function cleanId(v){return String(v||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);}
function cleanEvent(v){return String(v||"").replace(/[^a-zA-Z0-9_.:-]/g,"_").slice(0,64)||"event";}
function dayKey(ts=Date.now()){const d=new Date(ts);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
const ALLOWED_EVENTS=new Set([
  "adaptive_difficulty","auto_move","bonus_objective_completed","calm_completed","category_completed","category_discovered","category_mastered",
  "challenge_accepted","challenge_completed","challenge_created","challenge_shared","collection_completed","daily_completed","deadlock_detected","first_open",
  "funnel_level_1_complete","funnel_level_2_complete","funnel_level_5_complete","hint_used","hub_opened","level_completed","level_restarted","level_started",
  "marathon_round_completed","onboarding_complete","onboarding_started","picture_category_mastered","progress_exported","pwa_installed","pwa_prompt","rank_up",
  "result_shared","retention_d1","retention_d7","rule_mode_completed","run_failed","session_started","stock_draw","tutorial_all_complete","tutorial_completed",
  "undo","weekly_digest_shown","xp_awarded"
]);
const ANALYTICS_TTL=15552000, MAX_EVENT_AGE=90*24*60*60*1000, MAX_CLOCK_SKEW=10*60*1000;
export function OPTIONS(){return json({ok:true});}
export async function POST(request){
  try{
    if(!sameOrigin(request))return json({error:"forbidden_origin"},403);
    if(!(await checkRateLimit(request,"analytics-write",240,900)))return json({error:"rate_limited"},429);
    const body=await request.json().catch(()=>({})),clientId=cleanId(body.clientId),events=Array.isArray(body.events)?body.events.slice(0,40):[];
    if(!clientId||!events.length)return json({ok:true,accepted:0});
    const now=Date.now(),byDay=new Map();
    for(const raw of events){
      const name=cleanEvent(raw?.name);if(!ALLOWED_EVENTS.has(name))continue;
      const rawTime=Number(raw?.t),t=Number.isFinite(rawTime)?Math.max(now-MAX_EVENT_AGE,Math.min(now+MAX_CLOCK_SKEW,rawTime)):now,day=dayKey(t);
      if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(name);
    }
    let accepted=0;
    for(const [day,names] of byDay){
      await redis(["PFADD",`worditaire:analytics:users:${day}`,clientId]);
      for(const name of names){
        await redis(["HINCRBY",`worditaire:analytics:events:${day}`,name,1]);
        await redis(["HINCRBY","worditaire:analytics:events:all",name,1]);
        await redis(["PFADD",`worditaire:analytics:event-users:${day}:${name}`,clientId]);
        await redis(["EXPIRE",`worditaire:analytics:event-users:${day}:${name}`,ANALYTICS_TTL]);
        accepted++;
      }
      await redis(["EXPIRE",`worditaire:analytics:events:${day}`,ANALYTICS_TTL]);
      await redis(["EXPIRE",`worditaire:analytics:users:${day}`,ANALYTICS_TTL]);
    }
    return json({ok:true,accepted});
  }catch(error){console.error("analytics POST",error);return json({error:"server_error"},500);}
}
export async function GET(request){
  try{
    const url=new URL(request.url),token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"",expected=process.env.ANALYTICS_ADMIN_TOKEN||"";
    if(!expected)return json({error:"analytics_admin_token_not_configured"},503);
    if(!(await checkRateLimit(request,"analytics-read",60,900)))return json({error:"rate_limited"},429);
    if(token!==expected)return json({error:"forbidden"},403);
    const days=Math.max(1,Math.min(30,Number(url.searchParams.get("days"))||7)),out=[];
    for(let i=0;i<days;i++){
      const d=new Date();d.setUTCDate(d.getUTCDate()-i);const day=dayKey(d.getTime());
      const [events,users]=await Promise.all([redis(["HGETALL",`worditaire:analytics:events:${day}`]),redis(["PFCOUNT",`worditaire:analytics:users:${day}`])]);
      const obj={};if(Array.isArray(events))for(let j=0;j<events.length;j+=2)obj[events[j]]=Number(events[j+1])||0;
      out.push({day,users:Number(users)||0,events:obj});
    }
    const all=await redis(["HGETALL","worditaire:analytics:events:all"]),totals={};if(Array.isArray(all))for(let i=0;i<all.length;i+=2)totals[all[i]]=Number(all[i+1])||0;
    return json({ok:true,days:out,totals});
  }catch(error){console.error("analytics GET",error);return json({error:"server_error"},500);}
}
