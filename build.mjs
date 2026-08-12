// Builds index.html from index.template.html by:
//  1. inlining settlement.mjs (the single source of truth for the engine), and
//  2. substituting the Supabase URL + anon key.
// The anon key is public-safe by design (it only grants what RLS allows).
// Run: node build.mjs
import { readFile, writeFile } from 'node:fs/promises';

const SUPABASE_URL = 'https://vmambvgovdxepgejdgcy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtYW1idmdvdmR4ZXBnZWpkZ2N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0ODczNDEsImV4cCI6MjEwMjA2MzM0MX0.oj4Tgbg-Y7mTiaB7QCAl2vx9WsxvJXJ4RV_AnhP4h0w';

const template = await readFile(new URL('./index.template.html', import.meta.url), 'utf8');
let engine = await readFile(new URL('./settlement.mjs', import.meta.url), 'utf8');

// Strip ES module `export` keywords so the functions become plain top-level
// declarations usable inside the page's inline module scope.
engine = engine.replace(/^export\s+/gm, '');

const out = template
  .replace('/*__ENGINE__*/', () => engine.trim())
  .replaceAll('__SUPABASE_URL__', SUPABASE_URL)
  .replaceAll('__SUPABASE_ANON_KEY__', SUPABASE_ANON_KEY);

if (out.includes('__SUPABASE_URL__') || out.includes('__SUPABASE_ANON_KEY__') ||
    out.includes('/*__ENGINE__*/')) {
  throw new Error('build: unresolved placeholder remains');
}

await writeFile(new URL('./index.html', import.meta.url), out);
console.log('Wrote index.html (' + out.length + ' bytes)');
