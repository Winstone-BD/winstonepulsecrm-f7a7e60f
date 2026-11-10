import { describe,expect,it,vi } from "vitest";
const state=vi.hoisted(()=>({scope:"authority",readError:false,reads:0}));
vi.mock("@tanstack/react-start",()=>({createServerFn:()=>({inputValidator:(validate:(v:unknown)=>unknown)=>({handler:(fn:(v:unknown)=>unknown)=>(args:{data:unknown})=>fn({data:validate(args.data)})})})}));
vi.mock("@/lib/access.server",()=>({resolveCaller:async()=>({scope:state.scope})}));
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{from:()=>{state.reads++;const q:Record<string,unknown>={};for(const key of ["select","in","eq","lt","gte","order"])q[key]=()=>q;q.range=async()=>({data:[],error:state.readError?{message:"private database detail"}:null});return q;}}}));
import { readAgentSalesScorecards } from "@/lib/agent-sales-scorecard.functions";
const run=readAgentSalesScorecards as unknown as (args:{data:{from:string;to:string}})=>Promise<{rows:unknown[]}>;
const data={from:"2026-11-01",to:"2026-11-10"};
describe("sales scorecard authority boundary",()=>{
 it.each(["agent","none"])("refuses %s before reading evidence",async scope=>{state.scope=scope;state.reads=0;await expect(run({data})).rejects.toThrow("Executive HQ or IT access required");expect(state.reads).toBe(0);});
 it("allows read-only authority and returns aggregate rows",async()=>{state.scope="authority";state.readError=false;const out=await run({data});expect(out.rows).toEqual([]);});
 it("fails rather than fabricating zero counts when evidence fails",async()=>{state.scope="authority";state.readError=true;await expect(run({data})).rejects.toThrow("Scorecard evidence unavailable");state.readError=false;});
 it("rejects invalid dates before reading evidence",()=>{state.reads=0;expect(()=>run({data:{from:"2026-02-30",to:"2026-03-01"}})).toThrow();expect(state.reads).toBe(0);});
});