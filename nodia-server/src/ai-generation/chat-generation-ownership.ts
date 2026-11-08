import { createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { NodiaAiClaim } from '../nodia-ai-runtime/types/worker.types.js';
import type { NodiaAiRuntimeTerminalProof } from '../nodia-ai-runtime/types/reconciliation.types.js';
import { terminalRuntimeProofDescriptor } from '../nodia-ai-runtime/use-case/runtime-reconciliation-descriptor.js';

/** A pre-Teacher schema keeps its legacy wrapper; a bridged schema writes real owners. */
export async function hasGenerationBridge(manager:EntityManager):Promise<boolean>{
  const rows:{present:boolean}[]=await manager.query("SELECT to_regclass('public.ai_generation_operations') IS NOT NULL AS present");
  return rows[0]?.present===true;
}
export async function reserveChatGeneration(manager:EntityManager,claim:NodiaAiClaim,resourceKey:string,runtimeFence:string):Promise<boolean>{
  if(!await hasGenerationBridge(manager))return false;
  const configuration=claim.run.context_manifest.configuration_generation;
  const session=claim.run.context_manifest.session_generation;
  if(typeof configuration!=='string'||typeof session!=='string')throw Error('nodia_ai:eligibility_changed');
  await manager.query(`INSERT INTO ai_generation_operations(id,owner_kind,chat_attempt_id,chat_job_id,chat_conversation_id,actor_id,auth_session_public_id,
    connection_id,selection_snapshot,configuration_generation,session_generation,resource_key,worker_id,owner_fence,runtime_fence,phase,request_hash,exchange_limit)
    VALUES($1,'chat',$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,'reserved',$14,$15)`,
    [claim.attempt.id,claim.job.id,claim.job.conversation_id,claim.identity.userId,claim.identity.sessionId,
      claim.run.selection_snapshot.connection_id,JSON.stringify(claim.run.selection_snapshot),configuration,session,resourceKey,
      claim.attempt.worker_id,claim.job.fence,runtimeFence,createHash('sha256').update(claim.attempt.id).digest('hex'),claim.run.budget_snapshot.provider_dispatches]);
  return true;
}
export async function armChatGeneration(manager:EntityManager,attemptId:string):Promise<void>{
  if(!await hasGenerationBridge(manager))return;
  await manager.query("UPDATE ai_generation_operations SET phase='dispatch_armed',reserved_exchanges=1,updated_at=clock_timestamp() WHERE id=$1 AND owner_kind='chat' AND phase='reserved'",[attemptId]);
}
export async function finishChatGeneration(manager:EntityManager,attemptId:string,proof:NodiaAiRuntimeTerminalProof):Promise<void>{
  if(!await hasGenerationBridge(manager))return;
  await manager.query(`UPDATE ai_generation_operations SET phase='closed',terminal_proof=$2::jsonb,remote_outcome=$3,updated_at=clock_timestamp()
    WHERE id=$1 AND owner_kind='chat'`,[attemptId,JSON.stringify(terminalRuntimeProofDescriptor(proof)),proof.outcome==='completed'?'completed':'unknown']);
}

/** Chat expiry keeps its existing minimal operational journal. Detach only the neutral
 * chat projection before the legacy job loses its conversation FK. Capacity stays unknown,
 * fenced and unavailable until the ORIGINAL legacy proof is reconciled; Teacher is untouched. */
export async function retireChatGenerationOwners(manager:EntityManager,conversationId:string):Promise<void>{
  if(!await hasGenerationBridge(manager))return;
  await manager.query(`UPDATE nodia_ai_runtime_slots SET generation_operation_id=NULL WHERE generation_operation_id IN(
    SELECT id FROM ai_generation_operations WHERE owner_kind='chat' AND chat_conversation_id=$1)`,[conversationId]);
  await manager.query("DELETE FROM ai_generation_operations WHERE owner_kind='chat' AND chat_conversation_id=$1",[conversationId]);
}
