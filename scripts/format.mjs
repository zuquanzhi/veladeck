import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { format } from 'prettier';
const root = resolve(process.argv[2] ?? '.');
let count = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.tools', 'data', 'dist', 'build', '.gradle'].includes(entry.name))
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (
      ['.ts', '.tsx', '.js', '.mjs', '.css', '.json', '.yml', '.html'].includes(extname(path))
    ) {
      const text = await readFile(path, 'utf8');
      const pretty = await format(text, {
        filepath: path,
        singleQuote: true,
        printWidth: 100,
        trailingComma: 'all',
      });
      await writeFile(path, pretty);
      count++;
    }
  }
}
await walk(root);
console.log(`Formatted ${count} source and configuration files.`);
