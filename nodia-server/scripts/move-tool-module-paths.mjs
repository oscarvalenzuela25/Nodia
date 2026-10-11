import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import source from '../dist/config/data-source.js';

// Only navigation metadata: no pending schema migrations or module assignments.
const paths = new Map([
  ['/business', '/tools/business'],
  ['/finances/personal', '/tools/finances-personal'],
]);
try {
  await source.initialize();
  await source.transaction(async manager => {
    await manager.query('LOCK TABLE modules IN SHARE ROW EXCLUSIVE MODE');
    const before = await manager.query('SELECT * FROM modules ORDER BY id');
    const affected = before.filter(row => paths.has(row.link));
    if (affected.length) {
      const directory = join(process.env.LOCALAPPDATA ?? homedir(), 'Nodia', 'backups');
      await mkdir(directory, { recursive: true });
      const backup = join(directory, `tool-module-paths-${new Date().toISOString().replaceAll(':', '-')}.json`);
      await writeFile(backup, JSON.stringify(affected, null, 2), { flag: 'wx' });
      console.log(`Navigation backup: ${backup}`);
      for (const row of affected) {
        await manager.query('UPDATE modules SET link=$1, updated_at=now() WHERE id=$2 AND link=$3',
          [paths.get(row.link), row.id, row.link]);
      }
    }
    const after = await manager.query('SELECT * FROM modules ORDER BY id');
    assert.deepEqual(after.map(row => {
      const old = before.find(item => item.id === row.id);
      return paths.has(old.link) ? { ...row, updated_at: old.updated_at } : row;
    }), before.map(row => ({ ...row, link: paths.get(row.link) ?? row.link })));
    console.log(JSON.stringify({ updated: affected.length, modules: after
      .filter(row => [...paths.values()].includes(row.link))
      .map(({ id, key, link }) => ({ id, key, link })) }, null, 2));
  });
} finally {
  if (source.isInitialized) await source.destroy();
}
