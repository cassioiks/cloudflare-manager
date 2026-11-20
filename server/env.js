// Loads KEY=VALUE pairs from <repo>/.env into process.env.
// Variables that are already set (shell, systemd, launchd) take precedence.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

function parseValue(raw) {
  const value = raw.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
    return value.slice(1, -1);
  }
  return value.replace(/\s+#.*$/, '');
}

try {
  const text = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = parseValue(match[2]);
    }
  }
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
