from pathlib import Path
s=Path('nodia-server/test/nodia-ai-ai26.integration.mjs').read_text();s=s[:s.index('  let [destination]')];s=s.replace('ai26','ai27').replace('AI26','AI27');s=s.replace("['rental-reservation', 'rental-payment', 'rental-calendar', 'rental-turnover', 'rental-expense', 'rental-block']", "['user', 'role', 'action', 'business-action', 'module', 'module-group']")
s=s.replace("  const Clock = await loadAi('rental-common/rental-clock', 'RentalClock');\n",'').replace('  builder.overrideProvider(Clock).useValue({now: () => new Date(now)});\n','').replace('keys: async () => []','keys: async () => [], delByPattern: async () => {}')
s=s.replace("let now = new Date('2030-05-01T12:00:00.000Z');\n",'')
Path('nodia-server/test/nodia-ai-ai27.integration.mjs').write_text(s)
s=Path('nodia-server/test/nodia-ai-ai26-worker.fixture.mjs').read_text().replace('ai26','ai27').replace('AI26','AI27');s=s.replace("const Clock = await load('rental-common/rental-clock', 'RentalClock');\n",'').replace("}).overrideProvider(Clock).useValue({ now: () => new Date('2030-05-01T12:00:00.000Z') })", '})').replace('keys: async () => []','keys: async () => [], delByPattern: async () => {}')
Path('nodia-server/test/nodia-ai-ai27-worker.fixture.mjs').write_text(s)
