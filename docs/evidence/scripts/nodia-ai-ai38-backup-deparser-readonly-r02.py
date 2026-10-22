"""VM read-only schema display/physical ordinal diagnostic. No container or backup."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


NODE = r'''
import fs from 'node:fs';import{createRequire}from'node:module';
const root=process.argv[2],require=createRequire(root+'/package.json');
const env=require('dotenv').parse(fs.readFileSync(root+'/.env'));const{DataSource}=require('typeorm');
const db=await new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),
username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB,entities:[],synchronize:false,
extra:{options:'-c default_transaction_read_only=on'}}).initialize();
try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await db.query("SET LOCAL statement_timeout='10000ms'");
const before=(await db.query("SELECT current_setting('search_path') search_path,current_setting('server_version_num')::int version"))[0];
const dropped=(await db.query(`SELECT count(*)::int n FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND a.attisdropped`))[0].n;
const gaps=(await db.query(`SELECT coalesce(sum(gap),0)::int n FROM (SELECT max(ordinal_position)-count(*) gap FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name)t`))[0].n;
const sql=`SELECT jsonb_build_object('columns',(SELECT jsonb_agg(jsonb_build_array(table_name,column_name,ordinal_position,column_default,is_nullable,data_type,udt_name) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')) value`;
const values=[];values.push({context:'configured_default',value:(await db.query(sql))[0].value});
for(const[tag,path]of[['public_first','public,pg_catalog'],['catalog_first','pg_catalog,public']]){await db.query('SET LOCAL search_path='+path);values.push({context:tag,value:(await db.query(sql))[0].value});}
values.push({context:'constraint_C_collation',value:(await db.query(sql.replace('ORDER BY c.relname,k.conname','ORDER BY c.relname COLLATE \"C\",k.conname COLLATE \"C\"')))[0].value});
process.stdout.write(JSON.stringify({before,dropped,gaps,values}));await db.query('ROLLBACK');
}finally{await db.destroy();}
'''


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    assert len(sys.argv) == 2 and re.fullmatch(r'[a-f0-9]{64}', sys.argv[1])
    source = Path('/tmp/nodia-ai-ai38-adoption-backup-r02.py')
    assert hashlib.sha256(source.read_bytes()).hexdigest() == '0e257902e86a6fc7c1cfa3049b72a369a923d13ba8230acc3ddbe858b7428d05'
    prior = json.loads(Path('/opt/nodia/verification/ai38-adoption-backup-r02/public-report.json').read_text(encoding='utf-8'))
    assert prior['status'] == 'failed_preserved_no_retry' and prior['execution_stage'] == 'compare_metadata'
    assert set(prior['metadata_comparison']['mismatched_keys']) == {'columns', 'constraints'}
    result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', '/opt/nodia/releases/nodia-server-ai15-20261016'],
                            input=NODE.encode(), capture_output=True, check=True, timeout=40,
                            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/nonexistent', 'DOTENV_CONFIG_PATH': '/dev/null'})
    value = json.loads(result.stdout)
    expected = prior['metadata_comparison']['restored_digests']
    cases = []
    for case in value['values']:
        columns, constraints = case['value']['columns'], case['value']['constraints']
        dense, visible = [], {}
        for row in columns:
            row = row.copy()
            visible[row[0]] = visible.get(row[0], 0) + 1
            row[2] = visible[row[0]]
            dense.append(row)
        cases.append({'context': case['context'], 'columns_sha256': digest(columns),
                      'constraints_sha256': digest(constraints), 'visible_ordinal_columns_sha256': digest(dense),
                      'columns_equal_restored_r02': digest(columns) == expected['columns'],
                      'constraints_equal_restored_r02': digest(constraints) == expected['constraints'],
                      'visible_ordinal_columns_equal_restored_r02': digest(dense) == expected['columns'],
                      'Python_lexically_sorted_constraints_sha256': digest(sorted(constraints,key=lambda row:(row[0],row[1]))),
                      'Python_lexically_sorted_constraints_equal_restored_r02': digest(sorted(constraints,key=lambda row:(row[0],row[1]))) == expected['constraints']})
    report = {'stage': 'AI-38', 'scope': 'read_only_schema_deparser_context_and_visible_ordinals',
              'status': 'observed_not_backup_acceptance', 'caller_pinned_source_sha256': sys.argv[1],
              'original_server_version_num': value['before']['version'],
              'configured_search_path_sha256': digest(value['before']['search_path']),
              'dropped_column_count': value['dropped'], 'ordinal_gap_count': value['gaps'], 'cases': cases,
              'configured_SQL_writes': 0, 'provider_requests': 0, 'containers_created': 0,
              'services_modified': False, 'backups_created': 0, 'original_database_restored': False}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
