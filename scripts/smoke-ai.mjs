/**
 * 생성형 AI 4개 task 스모크 테스트. 배포 전에 키가 실제로 동작하는지 로컬에서 확인한다.
 *
 *   GEMINI_API_KEY=... node scripts/smoke-ai.mjs            # 4개 task 순서대로 호출
 *   GEMINI_API_KEY=... node scripts/smoke-ai.mjs --models   # 이 키로 쓸 수 있는 Gemini 모델 목록
 *   GEMINI_API_KEY=... node scripts/smoke-ai.mjs ask        # 특정 task 하나만
 *
 * ANTHROPIC_API_KEY만 있으면 Claude 경로로 같은 테스트가 돈다.
 * 무료 티어 분당 한도를 피하려고 task 사이에 4초 쉰다.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runTask } from '../api/ai.js';
import { computeStatutory, DESIGNATION_TOOLS } from '../public/lib/inheritance.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes('--models')) {
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY 가 필요합니다.'); process.exit(1); }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await ai.models.list({ config: { pageSize: 100 } });
  const rows = [];
  for await (const m of pager) {
    const name = (m.name || '').replace(/^models\//, '');
    if (!/gemini/.test(name)) continue;
    rows.push({ name, methods: (m.supportedActions || []).join(',') });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows) console.log(r.name.padEnd(40), r.methods);
  console.log(`\n${rows.length}개. 기본값은 GEMINI_MODEL 미설정 시 gemini-flash-latest.`);
  process.exit(0);
}

/* 예시 상황: 6년째 생활비를 함께 쓰는 동반자가 있는 1인 가구 (index.html의 예시와 같은 구도) */
const assets = [
  { id: 'a0', type: 'insurance', typeLabel: '보험', inst: '', amount: 50_000_000 },
  { id: 'a1', type: 'deposit', typeLabel: '예금', inst: '', amount: 30_000_000 },
];
const people = [
  { id: 'p0', name: '정○○', relation: 'partner' },
  { id: 'p1', name: '어머니', relation: 'parent' },
  { id: 'p2', name: '이복형', relation: 'sibling' },
];
const estate = assets.reduce((s, a) => s + a.amount, 0);
const statutory = { ...computeStatutory(people, estate), assets, people };
const csv = readFileSync(join(here, '../public/sample-transactions.csv'), 'utf8');

const INPUTS = {
  relation: { transactions: csv },
  diagnose: {
    statutory: { heirs: statutory.heirs, excluded: statutory.excluded, freeDisposable: statutory.freeDisposable },
    relations: [{ counterparty: '정○○', inferred_relation: '생계공유', confidence: '높음', months_observed: 72, total_amount: 68_000_000 }],
  },
  draft: {
    target: '정○○',
    relationship: '6년째 함께 생활해 온 동반자(혼인신고 없음)',
    assets,
    tools: Object.fromEntries(assets.map((a) => [a.typeLabel, DESIGNATION_TOOLS[a.type]])),
    statutory: { heirs: statutory.heirs, excluded: statutory.excluded, freeDisposable: statutory.freeDisposable },
  },
  ask: {
    question: '혼인신고를 안 한 동반자에게 예금을 남기려면 유언장만으로 충분한가요?',
    context: { heirs: statutory.heirs, excluded: statutory.excluded },
  },
};

const only = args.find((a) => INPUTS[a]);
const tasks = only ? [only] : Object.keys(INPUTS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
for (const [i, task] of tasks.entries()) {
  const t0 = Date.now();
  try {
    const out = await runTask(task, INPUTS[task]);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n✅ ${task}  [${out.provider}]  ${sec}s  in=${out.usage.input_tokens} out=${out.usage.output_tokens}`);
    console.log(JSON.stringify(out.result, null, 2).slice(0, 1500));
  } catch (e) {
    failed++;
    console.log(`\n❌ ${task}  status=${e.status ?? '-'}  ${e.message}`);
  }
  if (i < tasks.length - 1) await sleep(4000);
}
console.log(`\n${tasks.length - failed}/${tasks.length} 통과`);
process.exit(failed ? 1 : 0);
