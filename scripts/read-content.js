// Đọc toàn bộ data/vocab/*.csv, data/lessons/*.json, data/readings/*.json (dùng chung cho validate và pack).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadContentFiles } from '../src/core/importer.js';

export function readContentDir(root = 'data') {
  const files = [];
  for (const [sub, ext] of [['vocab', '.csv'], ['lessons', '.json'], ['readings', '.json']]) {
    const dir = join(root, sub);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (name.toLowerCase().endsWith(ext)) files.push({ name: `${sub}/${name}`, text: readFileSync(join(dir, name), 'utf8') });
    }
  }
  return { files, result: loadContentFiles(files) };
}
