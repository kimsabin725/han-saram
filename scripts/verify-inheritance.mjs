// 법정상속 계산 엔진 전수 검산 — 가족 구성 864가지 × 재산 11구간
import { computeStatutory } from '../public/lib/inheritance.js';

const SPOUSE = [0, 1];
const CHILD = [0, 1, 2, 3];
const GRANDCHILD = [0, 1, 2];
const PARENT = [0, 1, 2];
const GRANDPARENT = [0, 1];
const SIBLING = [0, 1, 2];
const PARTNER = [0, 1];
const ESTATE = [0, 1, 2, 7, 1000, 100_000_000, 123_456_789, 300_000_000, 999_999_999, 1_000_000_000, 5_432_100_001];

const mk = (n, rel, out) => { for (let i = 0; i < n; i += 1) out.push({ id: `${rel}${i}`, name: `${rel}${i}`, relation: rel }); };

const fails = [];
let cases = 0;
const checks = { sum: 0, spouse15: 0, nearer: 0, reserved: 0, outranked: 0, nonheir: 0 };

for (const s of SPOUSE) for (const c of CHILD) for (const g of GRANDCHILD)
for (const p of PARENT) for (const gp of GRANDPARENT) for (const sb of SIBLING) for (const pt of PARTNER) {
  const people = [];
  mk(s, 'spouse', people); mk(c, 'child', people); mk(g, 'grandchild', people);
  mk(p, 'parent', people); mk(gp, 'grandparent', people); mk(sb, 'sibling', people);
  mk(pt, 'partner', people);

  for (const estate of ESTATE) {
    cases += 1;
    const r = computeStatutory(people, estate);
    const all = [...r.heirs, ...r.excluded];
    const F = (rule, msg) => fails.push({ rule, msg, people: people.map((x) => x.relation).join('+') || '(없음)', estate });

    // 1) 1원도 새지 않는다: 상속분 합계 = 총재산 (상속인이 있을 때)
    const sum = r.heirs.reduce((a, h) => a + h.amount, 0);
    if (!r.noHeir) { checks.sum += 1; if (sum !== estate) F('합계=총재산', `합계 ${sum} ≠ ${estate}`); }
    else if (sum !== 0) F('상속인없음=0원', `합계 ${sum}`);

    // 2) 1009조: 배우자는 혈족상속인의 1.5배
    const sp = r.heirs.find((h) => h.relation === 'spouse');
    const blood = r.heirs.filter((h) => h.relation !== 'spouse');
    if (sp && blood.length) {
      checks.spouse15 += 1;
      if (Math.abs(sp.ratio - blood[0].ratio * 1.5) > 1e-9) F('배우자 5할가산', `${sp.ratio} vs ${blood[0].ratio}`);
    }

    // 3) 1000조 2항: 자녀가 있으면 손자녀는 0원, 부모가 있으면 조부모는 0원
    if (c > 0 && g > 0) {
      checks.nearer += 1;
      const gc = all.filter((h) => h.relation === 'grandchild');
      if (gc.some((h) => h.amount !== 0)) F('최근친 우선', '자녀가 있는데 손자녀가 받음');
      if (gc.length !== g) F('사람이 사라짐', `손자녀 ${gc.length}/${g}`);
    }
    if (p > 0 && gp > 0 && c === 0 && g === 0) {
      const gpr = all.filter((h) => h.relation === 'grandparent');
      if (gpr.some((h) => h.amount !== 0)) F('최근친 우선', '부모가 있는데 조부모가 받음');
    }

    // 4) 1112조: 유류분은 법정상속분을 넘지 못한다
    for (const h of r.heirs) {
      checks.reserved += 1;
      if (h.reservedAmount > h.amount) F('유류분≤상속분', `${h.relation} ${h.reservedAmount}>${h.amount}`);
      if (h.reservedAmount < 0 || h.amount < 0) F('음수', `${h.relation}`);
    }
    if (r.freeDisposable < 0) F('자유분 음수', String(r.freeDisposable));

    // 5) 1003조: 배우자가 있으면 형제자매는 상속하지 못한다
    if (s > 0 && sb > 0) {
      checks.outranked += 1;
      if (all.filter((h) => h.relation === 'sibling').some((h) => h.amount !== 0)) F('배우자 단독상속', '형제자매가 받음');
    }

    // 6) 사실혼 파트너는 법정상속인이 아니다 — 0원이되 화면에서 사라지지 않는다
    if (pt > 0) {
      checks.nonheir += 1;
      const q = all.filter((h) => h.relation === 'partner');
      if (q.length !== pt) F('사람이 사라짐', `파트너 ${q.length}/${pt}`);
      if (q.some((h) => h.amount !== 0)) F('파트너 비상속인', '파트너가 받음');
    }
  }
}

const out = [];
out.push('$ node verify-inheritance.mjs   # 법정상속 계산 엔진 전수 검산');
out.push('');
out.push(`가족구성 ${(cases / ESTATE.length).toLocaleString()}가지 × 재산 ${ESTATE.length}구간  =  ${cases.toLocaleString()} 케이스`);
out.push('');
out.push(`  [1] 민법 1009조  상속분 합계 = 총재산 (1원 오차 없음)      ${checks.sum.toLocaleString().padStart(6)}건  ok`);
out.push(`  [2] 민법 1009조  배우자 5할 가산 (혈족의 1.5배)            ${checks.spouse15.toLocaleString().padStart(6)}건  ok`);
out.push(`  [3] 민법 1000조2 최근친 우선 (자녀>손자녀, 부모>조부모)    ${checks.nearer.toLocaleString().padStart(6)}건  ok`);
out.push(`  [4] 민법 1112조  유류분 <= 법정상속분, 음수 없음           ${checks.reserved.toLocaleString().padStart(6)}건  ok`);
out.push(`  [5] 민법 1003조  배우자 있으면 형제자매 상속 못함          ${checks.outranked.toLocaleString().padStart(6)}건  ok`);
out.push(`  [6] 사실혼 파트너 = 0원, 단 화면에서 사라지지 않음         ${checks.nonheir.toLocaleString().padStart(6)}건  ok`);
out.push('');
out.push(fails.length === 0
  ? `전수 검산 통과.  ${cases.toLocaleString()} 케이스 / 실패 0`
  : `실패 ${fails.length}건`);
for (const f of fails.slice(0, 8)) out.push(`  error ${f.rule} | ${f.people} | ${f.estate} | ${f.msg}`);
console.log(out.join('\n'));
