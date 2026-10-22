from pathlib import Path
p=Path('/opt/nodia/verification/ai21-20261017/test/finance.integration.mjs')
s=Path('/tmp/nodia-ai21-finance.integration.mjs').read_text()
s=s.replace('const checks = [];', "const checks = []; const synthetic_ai21_check_trace = checks.push.bind(checks); checks.push = (...items) => { console.error('AI21_NATIVE_CHECK', ...items); return synthetic_ai21_check_trace(...items); }; console.error('AI21_NATIVE_START');")
s=s.replace("  started = true;", """  started = true;
  for(let readiness=0; readiness<80; readiness++) {
    try { console.error('AI21_NATIVE_READY', readiness, docker('exec',container,'pg_isready','-h','127.0.0.1','-U','finance_test')); break; }
    catch(error) { if(readiness===79) throw error; await delay(250); }
  }
""")
s=s.replace('await db.initialize();', "console.error('AI21_NATIVE_CONNECT', attempt, port); await db.initialize(); console.error('AI21_NATIVE_CONNECTED');")
s=s.replace('if (attempt === 79) throw error;', "console.error('AI21_NATIVE_CONNECT_FAILURE', attempt, error.message); if(attempt===40) { console.error('AI21_NATIVE_PG_READY', docker('exec',container,'pg_isready','-h','127.0.0.1','-U','finance_test')); console.error('AI21_NATIVE_PG_PS',docker('exec',container,'ps','aux')); } if (attempt === 79) throw error;")
p.write_text(s)
