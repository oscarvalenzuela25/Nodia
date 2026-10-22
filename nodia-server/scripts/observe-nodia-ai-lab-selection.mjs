// Read-only configured Gemini selection. Run as the lab's API service user, never print fields/secrets.
import 'dotenv/config';
import pg from 'pg';
const client = new pg.Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT),
  database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,password:process.env.POSTGRES_PASSWORD});
try {
  await client.connect();
  const {rows}=await client.query(`SELECT p.id::text AS connection_id,p.is_active,p.use_token_plan_web,p.use_token_plan_agentic,
    c.key AS provider_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic,
    p.fields#>>'{token_plan_web,selected_model}' AS web_model,
    CASE WHEN jsonb_typeof(p.fields#>'{token_plan_web,thinking_levels}')='object'
      AND (p.fields#>'{token_plan_web,thinking_levels}') ? (p.fields#>>'{token_plan_web,selected_model}')
      THEN p.fields#>'{token_plan_web,thinking_levels}'->>(p.fields#>>'{token_plan_web,selected_model}')
      ELSE p.fields#>>'{token_plan_web,thinking_level}' END AS web_effort,
    p.fields#>>'{token_plan_agentic,selected_model}' AS agentic_model,
    CASE WHEN jsonb_typeof(p.fields#>'{token_plan_agentic,thinking_levels}')='object'
      AND (p.fields#>'{token_plan_agentic,thinking_levels}') ? (p.fields#>>'{token_plan_agentic,selected_model}')
      THEN p.fields#>'{token_plan_agentic,thinking_levels}'->>(p.fields#>>'{token_plan_agentic,selected_model}')
      ELSE p.fields#>>'{token_plan_agentic,thinking_level}' END AS agentic_effort
    FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' ORDER BY p.id`);
  console.log(JSON.stringify({observation:'configured_selection_only',rows},null,2));
} finally {await client.end();}
