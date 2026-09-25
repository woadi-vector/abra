// Live Storyteller eval — runs each case through the real Storyteller agent and
// scores every tell (code + judge). Needs Claude credentials (see evals/lib).
//
//   node evals/storyteller/run.mjs            # all cases
//   node evals/storyteller/run.mjs bongo max  # a subset by id
//
// A case PASSES only if every tell passes. Storyteller outputs are written to
// evals/storyteller/.out/<id>.json for inspection.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CASES, CASES_BY_ID } from './cases.js';
import { judgeTell } from './judge.js';
import { tellStory } from '../../src/agents/storyteller.js';
import { makeClient, hasCredentials, DEFAULT_MODEL } from '../lib/anthropic.js';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '.out');

function selectCases(argv) {
  const ids = argv.slice(2);
  if (!ids.length) return CASES;
  const picked = ids.map((id) => CASES_BY_ID[id]).filter(Boolean);
  const unknown = ids.filter((id) => !CASES_BY_ID[id]);
  if (unknown.length) console.warn(`Unknown case id(s): ${unknown.join(', ')}`);
  return picked;
}

async function scoreTell(ctx, tell, storybook, transcript) {
  if (tell.type === 'code') {
    const { pass, detail } = tell.run(storybook);
    return { name: tell.name, kind: 'code', pass, note: detail };
  }
  try {
    const { pass, reason } = await judgeTell(ctx, {
      transcript,
      tellName: tell.name,
      ask: tell.ask,
      storybook,
    });
    return { name: tell.name, kind: 'judge', pass, note: reason };
  } catch (e) {
    return { name: tell.name, kind: 'judge', pass: false, note: `judge error: ${e.message}` };
  }
}

async function main() {
  if (!hasCredentials()) {
    console.error(
      'No Claude credentials found. Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN)\n' +
        'and re-run. The offline checker test needs no key:\n' +
        '  node evals/storyteller/checks.test.mjs'
    );
    process.exit(2);
  }

  const client = makeClient();
  const model = DEFAULT_MODEL;
  const cases = selectCases(process.argv);
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Storyteller eval — model: ${model}\n`);
  let failedCases = 0;

  for (const c of cases) {
    process.stdout.write(`▶ ${c.name} (${c.traps})\n`);
    let storybook;
    try {
      storybook = await tellStory(c.transcript, { client, model });
    } catch (e) {
      failedCases++;
      console.log(`  ✗ Storyteller call failed: ${e.message}\n`);
      continue;
    }
    writeFileSync(join(OUT_DIR, `${c.id}.json`), JSON.stringify(storybook, null, 2));

    const scored = [];
    for (const tell of c.tells) {
      scored.push(await scoreTell({ client, model }, tell, storybook, c.transcript));
    }
    const casePass = scored.every((s) => s.pass);
    if (!casePass) failedCases++;

    for (const s of scored) {
      console.log(`  ${s.pass ? '✓' : '✗'} [${s.kind}] ${s.name}${s.note ? ` — ${s.note}` : ''}`);
    }
    console.log(`  → ${casePass ? 'PASS' : 'FAIL'} (${storybook.pages.length} pages) · saved .out/${c.id}.json\n`);
  }

  console.log(
    failedCases === 0
      ? `PASS — all ${cases.length} case(s) held structure.`
      : `FAIL — ${failedCases}/${cases.length} case(s) broke structure.`
  );
  process.exit(failedCases === 0 ? 0 : 1);
}

main();
