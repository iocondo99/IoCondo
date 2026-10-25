import { readFileSync } from 'node:fs';
const s1 = readFileSync('supabase/migrations/01_init_schema.sql', 'utf8').replace(/--.*$/gm, '');
const s2 = readFileSync('supabase/migrations/02_rls_policies.sql', 'utf8');

const tables = [...s1.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
const rls = [...s1.matchAll(/alter table public\.(\w+) enable row level security/g)].map((m) => m[1]);
console.log('tabelle', tables.length, '| con RLS', rls.length, '| senza RLS:', tables.filter((t) => !rls.includes(t)));

const pol = new Set([...s2.matchAll(/^\s*\('(\w+)',/gm)].map((m) => m[1]));
pol.add('utenti');
console.log('senza policy:', tables.filter((t) => !pol.has(t)));
console.log('policy su tabelle inesistenti:', [...pol].filter((t) => !tables.includes(t)));

console.log('float/real/double:', s1.match(/\b(float|real|double precision)\b/gi));
console.log('money-like colonne non numeric:', [...s1.matchAll(/^\s*(importo\w*|prezzo\w*|tariffa\w*|costo\w*|premio\w*)\s+(\w+)/gm)].filter((m) => m[2] !== 'numeric').map((m) => m[0].trim()));

// FK senza indice
const re = /create table public\.(\w+)\s*\(([\s\S]*?)\n\);([\s\S]*?)(?=create table|$)/g;
const missing = [];
for (const m of s1.matchAll(re)) {
  const [, t, body, after] = m;
  const fks = [...body.matchAll(/^\s*(\w+)\s+[\w()]+[^,\n]*references\s+public\.\w+/gm)].map((x) => x[1]);
  const idxText = after + body;
  for (const c of fks) {
    const pk = new RegExp(`^\\s*${c}\\s+[^\\n]*primary key`, 'm').test(body);
    const idx = new RegExp(`create (unique )?index[^;]*\\(\\s*${c}\\b`).test(after) ||
      new RegExp(`unique\\s*\\(\\s*${c}\\b`).test(body) || new RegExp(`primary key \\(\\s*${c}\\b`).test(body) || pk;
    if (!idx) missing.push(`${t}.${c}`);
  }
}
console.log('FK senza indice leading:', missing.join(', '));
