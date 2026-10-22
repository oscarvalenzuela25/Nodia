// Bounded operator setup observation; no application imports, HTTP or provider requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = '/opt/nodia/releases/nodia-server-ai15-20261016';
const conversationId = 'a160f615-ea41-4a05-831d-acdbb413ec4d';
const require = createRequire(`${root}/package.json`);
const sha = value => createHash('sha256').update(value).digest('hex');
let stage = 'connection', source, runner;
try {
  const config = require('dotenv').parse(fs.readFileSync(`${root}/.env`));
  const { DataSource } = require('typeorm');
  source = new DataSource({ type:'postgres',host:config.POSTGRES_HOST,port:Number(config.POSTGRES_PORT),
    database:config.POSTGRES_DB,username:config.POSTGRES_USER,password:config.POSTGRES_PASSWORD,
    ssl:config.POSTGRES_SSL==='true'?{rejectUnauthorized:false}:undefined,
    synchronize:false,migrationsRun:false,logging:false,
    extra:{connectionTimeoutMillis:5000,statement_timeout:5000,idle_in_transaction_session_timeout:15000} });
  await source.initialize(); runner=source.createQueryRunner(); await runner.connect();
  await runner.startTransaction('REPEATABLE READ'); await runner.query('SET TRANSACTION READ ONLY');
  const [tx]=await runner.query("SELECT current_setting('transaction_read_only') read_only,current_setting('transaction_isolation') isolation,now() observed_at_utc");
  assert.equal(tx.read_only,'on');assert.equal(tx.isolation,'repeatable read');
  stage='bounds';
  const [counts]=await runner.query(`SELECT
    (SELECT count(*)::int FROM users) users_total,
    (SELECT count(*)::int FROM users WHERE id='1') subject_users,
    (SELECT count(*)::int FROM module_groups WHERE key='finances') finances_groups,
    (SELECT count(*)::int FROM modules WHERE key='personal_finance') personal_finance_modules,
    (SELECT count(*)::int FROM user_modules WHERE user_id='1') subject_module_assignments,
    (SELECT count(*)::int FROM user_modules um JOIN modules m ON m.id=um.module_id WHERE m.key='personal_finance') personal_finance_assignments_all_users,
    (SELECT count(*)::int FROM finance_categories WHERE user_id='1' AND key='ai38_acceptance') subject_acceptance_categories,
    (SELECT count(*)::int FROM nodia_ai_conversations WHERE id=$1 AND owner_id='1') known_owned_conversation,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') public_base_tables,
    (SELECT count(*)::int FROM migrations) migrations`,[conversationId]);
  for(const [key,cap] of Object.entries({users_total:100,subject_users:1,finances_groups:1,personal_finance_modules:1,
    subject_module_assignments:100,personal_finance_assignments_all_users:100,subject_acceptance_categories:1,known_owned_conversation:1}))
    assert.ok(Number.isInteger(counts[key])&&counts[key]>=0&&counts[key]<=cap,'observation_cap_exceeded');
  assert.equal(counts.users_total,1);assert.equal(counts.subject_users,1);assert.equal(counts.finances_groups,1);
  assert.equal(counts.personal_finance_modules,1);assert.equal(counts.personal_finance_assignments_all_users,1);
  assert.equal(counts.subject_acceptance_categories,1);assert.equal(counts.known_owned_conversation,1);
  stage='projections';
  const subject=await runner.query(`SELECT id,is_active FROM users WHERE id='1' LIMIT 1`);
  const roles=await runner.query(`SELECT ur.user_id,r.id AS role_id,r.key,ur.is_active AS assignment_active,r.is_active AS role_active
    FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id='1' AND r.key='super_admin' LIMIT 2`);
  assert.equal(roles.length,1);assert.equal(roles[0].assignment_active,true);assert.equal(roles[0].role_active,true);
  const groups=await runner.query(`SELECT id,key,is_active FROM module_groups WHERE key='finances' LIMIT 1`);
  const modules=await runner.query(`SELECT id,module_group_id,key,link,is_active FROM modules WHERE key='personal_finance' LIMIT 1`);
  assert.equal(modules[0].module_group_id,groups[0].id);assert.equal(modules[0].link,'/tools/finances-personal');
  assert.equal(groups[0].is_active,true);assert.equal(modules[0].is_active,true);
  const assignments=await runner.query(`SELECT um.id,um.user_id,um.module_id,um.is_active
    FROM user_modules um WHERE um.user_id='1' ORDER BY um.module_id LIMIT 100`);
  const financeAssignments=assignments.filter(row=>row.module_id===modules[0].id);
  assert.equal(financeAssignments.length,1);assert.equal(financeAssignments[0].is_active,true);
  const categories=await runner.query(`SELECT id,user_id,key,is_active FROM finance_categories
    WHERE user_id='1' AND key='ai38_acceptance' LIMIT 1`);
  assert.equal(categories[0].id,'1');assert.equal(categories[0].is_active,true);
  const [chat]=await runner.query(`SELECT id,owner_id,selected_connection_id,selected_mode,selected_model_id,selected_effort_id,
    revision,lifecycle FROM nodia_ai_conversations WHERE id=$1 LIMIT 1`,[conversationId]);
  const [financialCount]=await runner.query(`SELECT count(*)::int owned_marker_movements FROM finance_movements
    WHERE user_id='1' AND name='AI38-UI-R01-20261020'`);
  await runner.commitTransaction();
  const snapshot={counts,subject,roles,groups,modules,subject_module_assignments:assignments,
    finance_assignment_count:financeAssignments.length,other_subject_assignment_count:assignments.length-financeAssignments.length,
    categories,conversation:chat,financial_marker_count:financialCount};
  console.log(JSON.stringify({schema:'ai38-live-setup-r01',status:'current_setup_observed_read_only',
    observed_at_VM_utc:tx.observed_at_utc,transaction:{read_only:true,isolation:tx.isolation},
    source_sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),connection_runtime_root:root,
    snapshot_sha256:sha(JSON.stringify(snapshot)),snapshot,configured_SQL_writes:0,provider_requests:0,
    private_config_or_identity_labels_emitted:false,deployed_sources_changed:false,
    provenance:['This is a new SQL observation of current state, not a reconstructed before snapshot.',
      'UI creation and preservation of seven earlier assignments are operator history requiring independent UI evidence.',
      'The current other-assignment count observes seven if present; it does not prove their prior identities or history.',
      'No names, email addresses, sessions, chat content or credentials are selected.']},null,2));
}catch{
  console.error(JSON.stringify({schema:'ai38-live-setup-r01',status:'failed',stage,diagnostic_details_withheld:true}));process.exitCode=1;
}finally{
  if(runner?.isTransactionActive)await runner.rollbackTransaction().catch(()=>{});
  if(runner)await runner.release().catch(()=>{});
  if(source?.isInitialized)await source.destroy().catch(()=>{});
}
