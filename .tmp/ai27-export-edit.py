from pathlib import Path
for name,klass in [('user','User'),('role','Role'),('action','Action'),('module','Module'),('module-group','ModuleGroup')]:
 p=Path('nodia-server/src')/name/f'{name}.module.ts';s=p.read_text();start=s.index('exports: [')+len('exports: [');end=s.index(']',start);values=s[start:end].strip();s=s[:start]+values+', Save'+klass+'UseCase'+('' if name=='user' else ', Delete'+klass+'UseCase')+s[end:];p.write_text(s)
