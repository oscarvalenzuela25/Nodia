// Synthetic corpus only. No operational credentials, configured DB or provider.
export async function seedAi37Performance(db, policy) {
  await db.query(`INSERT INTO users(id,email,name)
    SELECT n,'ai37-owner-'||n||'@example.invalid','AI37 synthetic queue owner '||n FROM generate_series(4,19)n`);
  await db.query(`CREATE FUNCTION ai37_id(value text) RETURNS uuid LANGUAGE SQL IMMUTABLE AS
    $$ SELECT overlay(overlay(md5(value) placing '4' from 13 for 1) placing 'a' from 17 for 1)::uuid $$`);
  await db.query(`INSERT INTO nodia_ai_conversations(id,owner_id,client_request_id,title,expires_at,creation_request_hash,updated_at,is_archived,is_pinned)
    SELECT ai37_id('chat-'||n),CASE WHEN n>19968 THEN 4+(n-19969)/2 WHEN n<=10000 THEN 1 ELSE 2 END,ai37_id('request-'||n),
      CASE WHEN n=9123 THEN 'RareTitleAI37' ELSE 'Synthetic product conversation '||n END,
      CASE WHEN n%200=0 THEN now()-interval '1 day' ELSE now()+interval '30 days' END,
      repeat('d',64),now()-(n * interval '1 microsecond'),n%5=0,n%7=0
    FROM generate_series(1,20000) n`);
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,author_id,client_message_id,input_hash,status,source_scope_manifest,sealed_at)
    SELECT ai37_id('message-'||n),ai37_id('chat-'||((n-1)/10+1)),(n-1)%10+1,
      CASE WHEN n%10=1 THEN 'user' ELSE 'assistant' END,
      CASE WHEN n%10=1 THEN CASE WHEN n<=100000 THEN 1 ELSE 2 END ELSE NULL END,
      CASE WHEN n%10=1 THEN ai37_id('client-'||n) ELSE NULL END,
      CASE WHEN n%10=1 THEN repeat('e',64) ELSE NULL END,
      'sealed','{"schema_version":1,"module_routes":[]}'::jsonb,now()
    FROM generate_series(1,200000) n`);
  await db.query(`INSERT INTO nodia_ai_messages(id,conversation_id,seq,role,status,source_scope_manifest,sealed_at)
    SELECT ai37_id('hot-message-'||n),ai37_id('chat-1'),n+10,'assistant','sealed',
      '{"schema_version":1,"module_routes":[]}'::jsonb,now() FROM generate_series(1,5000)n`);
  await db.query(`UPDATE nodia_ai_messages m SET author_id=c.owner_id FROM nodia_ai_conversations c
    WHERE m.conversation_id=c.id AND m.role='user' AND c.owner_id>=4`);
  await db.query(`INSERT INTO nodia_ai_message_parts(message_id,conversation_id,part_index,kind,text)
    SELECT id,conversation_id,0,'text',CASE WHEN seq=7 AND conversation_id=ai37_id('chat-9123') THEN 'RareBodyAI37 ' ELSE '' END ||
      repeat('Synthetic searchable message body with product information. ',10) FROM nodia_ai_messages`);
  const budget = { schema_version: 1, tool_calls: policy.budget.tool_calls_per_run,
    mcp_rpc_messages: policy.budget.mcp_rpc_messages_per_run, provider_dispatches: policy.budget.provider_dispatches_per_run,
    compactions: policy.budget.compactions_per_run, delegations: policy.budget.delegations_per_run };
  const [provider] = await db.query("INSERT INTO ai_providers(name,fields) VALUES('AI37 synthetic never called','{}') RETURNING id::text");
  const selection = { connection_id: provider.id, mode: 'token_plan_agentic', model_id: 'synthetic-fixture-not-provider-model', effort_id: null };
  await db.query(`INSERT INTO nodia_ai_runs(id,conversation_id,actor_id,user_message_id,connection_id,selection_snapshot,catalog_version,policy_version,policy_hash,
    routing_snapshot,budget_snapshot,input_through_seq,state,phase,deadline_at,retention_epoch,context_manifest,provider_dispatches_used)
    SELECT ai37_id('run-'||n),ai37_id('chat-'||n),CASE WHEN n>19968 THEN 4+(n-19969)/2 WHEN n<=10000 THEN 1 ELSE 2 END,
      ai37_id('message-'||((n-1)*10+1)),$1,$2,'ai37-synthetic-catalog',$3,$4,
      '{"schema_version":1,"enabled":false,"revision":1,"target":null}',$5,1,
      CASE WHEN n>19968 THEN 'queued' ELSE 'completed' END,'context',now()+interval '5 minutes',1,
      jsonb_build_object('schema_version',1,'resource_key','synthetic-ai37-profile','sources',jsonb_build_array(jsonb_build_object('content',repeat('bounded context ',100)))),1
    FROM generate_series(1,20000)n`, [provider.id, selection, policy.policyVersion, policy.policyHash, budget]);
  await db.query(`INSERT INTO nodia_ai_jobs(id,kind,dedup_key,conversation_id,run_id,state,available_at,deadline_at,stage_key)
    SELECT ai37_id('job-'||n),'turn','ai37-job-'||n,ai37_id('chat-'||n),ai37_id('run-'||n),
      CASE WHEN n>19968 THEN 'ready' ELSE 'done' END,now()-(n*interval '1 second'),now()+interval '5 minutes','context'
    FROM generate_series(1,20000)n`);
  await db.query(`UPDATE nodia_ai_conversations SET active_job_id=ai37_id('job-'||n)
    FROM generate_series(19969,20000)n WHERE id=ai37_id('chat-'||n)`);
  const [category] = await db.query("INSERT INTO finance_categories(user_id,name,key) VALUES(1,'AI37 synthetic food','ai37_food') RETURNING id::text");
  await db.query(`INSERT INTO finance_movements(user_id,category_id,name,amount,type,status,created_at)
    SELECT 1,$1,'AI37 synthetic expense',n%1000+1,'expense','paid',
      timestamptz '2026-01-01T00:00:00Z'+(n%365)*interval '1 day'
    FROM generate_series(1,100000)n`, [category.id]);
  await db.query('ANALYZE nodia_ai_conversations; ANALYZE nodia_ai_messages; ANALYZE nodia_ai_message_parts; ANALYZE nodia_ai_runs; ANALYZE nodia_ai_jobs; ANALYZE finance_movements');
}

export const summarizePlan = node => ({ node: node['Node Type'], relation: node['Relation Name'] ?? null,
  index: node['Index Name'] ?? null, actual_rows: node['Actual Rows'], loops: node['Actual Loops'],
  shared_hit_blocks: node['Shared Hit Blocks'] ?? 0, shared_read_blocks: node['Shared Read Blocks'] ?? 0,
  rows_removed_by_filter: node['Rows Removed by Filter'] ?? 0,
  ...(node.Plans ? { plans: node.Plans.map(summarizePlan) } : {}) });

export function quantiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { min_ms: sorted[0], median_ms: sorted[Math.floor(sorted.length / 2)], max_ms: sorted.at(-1) };
}
