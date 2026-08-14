import { redis } from "./_push-lib.mjs";

function json(data,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store, max-age=0","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});}
function cleanId(v){return String(v||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);}
function cleanEvent(v){return String(v||"").replace(/[^a-zA-Z0-9_.:-]/g,"_").slice(0,64)||"event";}
function dayKey(ts=Date.now()){const d=new Date(ts);return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;}
export function OPTIONS(){return json({ok:true});}
export async function POST(request){
  try{
    const body=await request.json().catch(()=>({})),clientId=cleanId(body.clientId),events=Array.isArray(body.events)?body.events.slice(0,40):[];
    if(!clientId||!events.length)return json({ok:true,accepted:0});
    const byDay=new Map();
    for(const raw of events){const name=cleanEvent(raw?.name),t=Number(raw?.t)||Date.now(),day=dayKey(t);if(!byDay.has(day))byDay.set(day,[]);byDay.get(day).push(name);}
    let accepted=0;
    for(const [day,names] of byDay){
      await redis(["PFADD",`worditaire:analytics:users:${day}`,clientId]);
      for(const name of names){
        await redis(["HINCRBY",`worditaire:analytics:events:${day}`,name,1]);
        await redis(["HINCRBY","worditaire:analytics:events:all",name,1]);
        await redis(["PFADD",`worditaire:analytics:event-users:${day}:${name}`,clientId]);
        accepted++;
      }
      await redis(["EXPIRE",`worditaire:analytics:events:${day}`,15552000]);
      await redis(["EXPIRE",`worditaire:analytics:users:${day}`,15552000]);
    }
    return json({ok:true,accepted});
  }catch(error){console.error("analytics POST",error);return json({error:"server_error"},500);}
}
export async function GET(request){
  try{
    const url=new URL(request.url),token=url.searchParams.get("token")||request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"",expected=process.env.ANALYTICS_ADMIN_TOKEN||"";
    if(!expected)return json({error:"analytics_admin_token_not_configured"},503);
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
