// Explicit isolated browser fixture. No operational SQL, session or provider.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import { AxiosError } from "axios";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "sileo/styles.css";
import "../../../styles/main.css";
import MUIProvider from "../../../providers/MUIProvider";
import { PageContent } from "../../../layouts/BaseLayout/styles";
import NodiaAI from "../../../modules/nodiaAi/pages/NodiaAI";
import { mainInstance } from "../../../config/api";
import { queryClient } from "../../../config/reactQuery";
import useAuthStore from "../../../store/authStore";
import useThemeStore from "../../../store/configStore";
import i18n from "../../../translate";
import { CHAT_ID, installFixture } from "./fixtures";
import { catalog, preference, preferenceProposal } from "../../modules/nodiaAi/infrastructure/preferenceFixtures";
import { execution as executionFixture } from "../../modules/nodiaAi/infrastructure/proposalFixtures";
import type { NodiaAiPreference, NodiaAiPreferencePrepare } from "../../../modules/nodiaAi/infrastructure/preferenceSchemas";
import type { NodiaAiPublicProposal } from "../../../modules/nodiaAi/infrastructure/types";

if (location.hostname !== "127.0.0.1" || location.port !== "5197") throw new Error("AI-33 synthetic QA requires its isolated 127.0.0.1:5197 origin");
const params = new URLSearchParams(location.search);
await i18n.changeLanguage(params.get("lang") === "en" ? "en" : "es");
useThemeStore.setState({ themeType: params.get("theme") === "light" ? "light" : "dark" });
const base = installFixture(null);
let proposal: NodiaAiPublicProposal = structuredClone(preferenceProposal);
let failList=false,failPrepare=false,failConfirm=false,operation:NodiaAiPreferencePrepare["operation"]="create";
let rows = [structuredClone(preference)];
let candidate=structuredClone(preference),previous:NodiaAiPreference|null=null;
const labelFor=(key:string,value:string)=>key==="business_id"?"Negocio sintético / Synthetic business":key==="supplier_id"?"Proveedor sintético / Synthetic supplier":key==="property_id"?"Alojamiento sintético / Synthetic property":value==="28"?"Viajes sintéticos / Synthetic travel":"Comida sintética / Synthetic food";
function rebuildProposal() {
  const fields=(item:NodiaAiPreference)=>({scope_key:item.scope_key,key:item.key,business_id:item.scope.business_id??null,value:item.value,value_label:item.value_label,scope_label:item.scope_label});
  const before=previous?fields(previous):null,after=fields(candidate);
  proposal={...proposal,steps:[{...proposal.steps[0],scope:{subject_user_id:"90000000991",...candidate.scope},tool_name:`nodia_preferences_prepare_${operation}`,
    target:previous?{resource_key:"nodia_ai_preferences",id:previous.preference_id}:null,
    changes:Object.entries(after).map(([field_key,value])=>({field_key,before:before?.[field_key as keyof typeof before]??null,before_present:previous!==null,after:operation==="delete"?null:value,after_present:operation!=="delete",origin:field_key.endsWith("_label")?"database":"user"}))}]};
}
const counts = { preparations: 0, challenges: 0, confirmations: 0, connection_writes: 0, message_writes: 0 };
const showCounts=()=>{const node=document.getElementById("qa-pref-calls");if(node)node.textContent=JSON.stringify(counts);};
mainInstance.defaults.skipAuth = true;
mainInstance.defaults.adapter = async request => {
  const url = request.url ?? "",method=request.method??"get";
  const response=(data:unknown)=>({config:request,data,status:200,statusText:"OK",headers:{}});
  const reject=():never=>{throw new AxiosError("Synthetic offline failure","ERR_BAD_RESPONSE",request,undefined,{...response({message:"Fallo sintético recuperable / Recoverable synthetic failure"}),status:503});};
  if(url==="/nodia-ai/preferences/catalog")return response(catalog);
  if(url==="/nodia-ai/preferences/options")return response({items:request.params?.key==="business_id"?[{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",label:labelFor("business_id","")}]:[{id:preference.value,label:labelFor(request.params?.key,preference.value)},{id:"28",label:labelFor(request.params?.key,"28")}],next_cursor:null});
  if(url==="/nodia-ai/preferences") {if(failList)return reject();return response({items:rows,next_cursor:null});}
  if(url==="/nodia-ai/preferences/prepare"){
    counts.preparations++;showCounts();if(failPrepare)return reject();
    const body=JSON.parse(request.data) as NodiaAiPreferencePrepare;operation=body.operation;
    previous=body.operation==="create"?null:rows.find(item=>item.preference_id===body.preference_id)??null;
    if(body.operation!=="create"&&!previous)throw new Error("Unknown synthetic preference");
    candidate=body.operation==="create"?{preference_id:crypto.randomUUID(),scope_key:body.scope_key,key:body.key,scope:body.scope,value:body.value,revision:1,value_label:labelFor(body.key,body.value),scope_label:body.scope.business_id?labelFor("business_id",""):null,available:true}
      :{...previous!,...(body.operation==="update"?{value:body.value,value_label:labelFor(previous!.key,body.value),revision:previous!.revision+1}:{})};
    proposal=structuredClone(preferenceProposal);rebuildProposal();
    return response({status:"ready",draft_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",proposal,missing_fields:[],clarification_keys:[],error:null});
  }
  if(url.endsWith(`/proposals/${proposal.proposal_id}/confirmation-challenge`)){counts.challenges++;showCounts();return response({proposal_id:proposal.proposal_id,proposal_revision:proposal.revision,expected_hash:proposal.hash,confirmation_token:"A".repeat(43),expires_at:new Date(Date.now()+60000).toISOString()});}
  if(url.endsWith(`/proposals/${proposal.proposal_id}/confirm`)){
    counts.confirmations++;showCounts();if(failConfirm)return reject();
    proposal={...proposal,state:"confirmed",execution_id:executionFixture.execution_id};
    rows=operation==="delete"?rows.filter(item=>item.preference_id!==candidate.preference_id):[...rows.filter(item=>item.preference_id!==candidate.preference_id),candidate];
    return response({execution:{...executionFixture,state:"completed",steps:[{...executionFixture.steps[0],state:"completed",result_refs:[{resource_key:"nodia_ai_preferences",id:candidate.preference_id}]}]}});
  }
  if(url.endsWith(`/operations/${executionFixture.execution_id}`))return response({...executionFixture,state:"completed",steps:[{...executionFixture.steps[0],state:"completed",result_refs:[{resource_key:"nodia_ai_preferences",id:candidate.preference_id}]}]});
  if(url.endsWith(`/proposals/${proposal.proposal_id}/review-metadata`))return response({proposal_id:proposal.proposal_id,revision:proposal.revision,hash:proposal.hash,read_only:proposal.state!=="ready",editable_fields:operation==="delete"?[]:[{step_id:proposal.steps[0].step_id,field_key:"value",label_key:"nodiaAi:proposal.preference_fields.value",kind:"text",nullable:false,max_length:36,minimum:null,maximum:null,options:[]}],confirmation:{available:true,reason:null}});
  if(url.endsWith(`/proposals/${proposal.proposal_id}`)){
    if(method==="patch"){
      const body=JSON.parse(request.data);const value=body.edits[0].value;
      candidate={...candidate,value,value_label:labelFor(candidate.key,value)};
      proposal={...proposal,revision:proposal.revision+1,hash:"b".repeat(64)};rebuildProposal();
    }
    return response(proposal);
  }
  if(method!=="get"){if(url.endsWith("/selection"))counts.connection_writes++;if(url.endsWith("/messages"))counts.message_writes++;showCounts();}
  if(typeof base.adapter!=="function")throw new Error("Synthetic base adapter unavailable");return base.adapter(request);
};
useAuthStore.getState().login({token:"synthetic-qa-only-not-a-real-credential",user:{id:"90000000991",name:"Synthetic QA"},expiresAt:Date.now()+3600000});
const reset=()=>{failList=false;failPrepare=false;failConfirm=false;void queryClient.invalidateQueries();};
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/nodia-ai?chat=${CHAT_ID}`]}><MUIProvider>
  <Box sx={{p:2,display:"flex",flexWrap:"wrap",gap:1}}><Typography sx={{width:"100%"}}>QA SINTÉTICO AI-33 · SIN BD NI PROVEEDOR / NO DATABASE OR PROVIDER</Typography>
    <Button onClick={()=>void i18n.changeLanguage("es")}>ES</Button><Button onClick={()=>void i18n.changeLanguage("en")}>EN</Button><Button onClick={()=>useThemeStore.setState({themeType:"light"})}>Claro / Light</Button><Button onClick={()=>useThemeStore.setState({themeType:"dark"})}>Oscuro / Dark</Button>
    <Button onClick={()=>{failList=true;void queryClient.invalidateQueries();}}>Fallo lista</Button><Button onClick={()=>{failPrepare=true;}}>Fallo preparación</Button><Button onClick={()=>{failConfirm=true;}}>Fallo confirmación</Button><Button onClick={reset}>Restablecer fallos</Button>
    <output id="qa-pref-calls" aria-label="Operaciones simuladas" style={{width:"100%",overflowWrap:"anywhere"}}>{JSON.stringify(counts)}</output>
  </Box><PageContent><NodiaAI/></PageContent></MUIProvider></MemoryRouter></QueryClientProvider>);
