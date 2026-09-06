import { computeStatutory, DESIGNATION_TOOLS } from '/lib/inheritance.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const won = (n) => (n || 0).toLocaleString('ko-KR') + '원';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// AI 호출 실패 시 — 왜 실패했는지와 다시 시도 버튼을 함께 보여준다
function showErr(box, msg, retry) {
  box.innerHTML = `<div class="err"><p>${esc(msg)}</p>
    <button class="ghost retry" type="button">다시 시도</button></div>`;
  box.querySelector('.retry').onclick = retry;
}

const state = { step: 1, statutory: null, relations: null, draft: null, csv: null };

const ASSET_TYPES = { deposit: '예금', insurance: '보험', securities: '증권계좌', pension: '연금', realestate: '부동산' };
const RELATIONS = {
  spouse: '배우자(혼인신고 O)', child: '자녀', grandchild: '손자녀', parent: '부모', grandparent: '조부모',
  sibling: '형제자매', collateral: '4촌 이내 친척', partner: '사실혼·동거 파트너', other: '그 밖에 지정하고 싶은 사람',
};

/* ── 입력 행 ─────────────────────────────── */
function assetRow(v = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="a-type">${Object.entries(ASSET_TYPES).map(([k, l]) => `<option value="${k}"${v.type === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><input class="a-inst" placeholder="예: OO은행" value="${esc(v.inst || '')}"></td>
    <td class="num"><input class="a-amt num" inputmode="numeric" placeholder="0" value="${v.amount ?? ''}"></td>
    <td><button class="x" type="button" aria-label="삭제">×</button></td>`;
  tr.querySelector('.x').onclick = () => { tr.remove(); syncTotal(); };
  tr.querySelector('.a-amt').oninput = syncTotal;
  return tr;
}
function personRow(v = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input class="p-name" placeholder="표시 이름(가명 가능)" value="${esc(v.name || '')}"></td>
    <td><select class="p-rel">${Object.entries(RELATIONS).map(([k, l]) => `<option value="${k}"${v.relation === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
    <td><button class="x" type="button" aria-label="삭제">×</button></td>`;
  tr.querySelector('.x').onclick = () => tr.remove();
  return tr;
}
const readAssets = () => $$('#assets tbody tr').map((tr, i) => ({
  id: 'a' + i, type: $('.a-type', tr).value, typeLabel: ASSET_TYPES[$('.a-type', tr).value],
  inst: $('.a-inst', tr).value.trim(), amount: parseInt($('.a-amt', tr).value.replace(/[^0-9]/g, ''), 10) || 0,
})).filter((a) => a.amount > 0);
const syncTotal = () => { $('#estateTotal').textContent = won(readAssets().reduce((s, a) => s + a.amount, 0)); };

$('#addAsset').onclick = () => { $('#assets tbody').append(assetRow()); };
$('#addPerson').onclick = () => { $('#people tbody').append(personRow()); };

/* 예시 상황: 사실혼 파트너 + 20년 연락 없는 이복형 */
$('#loadSample').onclick = () => {
  $('#assets tbody').innerHTML = ''; $('#people tbody').innerHTML = '';
  [{ type: 'deposit', inst: 'OO은행 예금', amount: 62000000 },
   { type: 'insurance', inst: 'OO생명 종신보험', amount: 100000000 },
   { type: 'securities', inst: 'OO증권 계좌', amount: 38000000 },
   { type: 'pension', inst: '개인연금(연금저축)', amount: 24000000 }].forEach((a) => $('#assets tbody').append(assetRow(a)));
  [{ name: '정○○', relation: 'partner' },
   { name: '김○자(어머니)', relation: 'parent' },
   { name: '이복형', relation: 'sibling' }].forEach((p) => $('#people tbody').append(personRow(p)));
  syncTotal();
  toast('예시 상황을 불러왔습니다 — 6년째 생활비를 함께 쓰는 동반자가 있는 1인 가구');
};

/* ── 1) 진단 (규칙 엔진, AI 없음) ───────────── */
$('#runDiagnose').onclick = () => {
  const assets = readAssets();
  const people = $$('#people tbody tr').map((tr, i) => ({
    id: 'p' + i, name: $('.p-name', tr).value.trim() || '이름없음', relation: $('.p-rel', tr).value,
  }));
  if (!assets.length) return toast('자산을 한 건 이상 입력하세요.');
  if (!people.length) return toast('사람을 한 명 이상 입력하세요.');

  const estate = assets.reduce((s, a) => s + a.amount, 0);
  const r = computeStatutory(people, estate);
  state.statutory = { ...r, assets, people };

  const rows = [...r.heirs, ...r.excluded];
  $('#flowChart').innerHTML = rows.map((h) => `
    <div class="flowrow${h.amount ? '' : ' zero'}">
      <div class="who"><span class="nm">${esc(h.name)}</span><span class="rel">${esc(h.relationLabel)}</span></div>
      <div class="amt">${won(h.amount)}${h.amount ? ` <span class="tag">${(h.ratio * 100).toFixed(1)}%</span>` : ''}</div>
      <div class="bar"><i style="width:${estate ? (h.amount / estate) * 100 : 0}%"></i></div>
      ${h.reason ? `<div class="reason">${esc(h.reason)}</div>` : ''}
    </div>`).join('');
  $('#flowNotes').innerHTML = r.notes.map((n) => `<li>${esc(n)}</li>`).join('') +
    `<li>지정으로 상속인이 아닌 사람에게 보낼 수 있는 최대 금액(총재산 − 유류분 합계): <b>${won(r.freeDisposable)}</b></li>`;
  $('#flow').hidden = false;
  fillTargets();
  markDone(1); toast('계산했습니다. 아래에서 결과를 확인하세요.');
  $('#flow').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ── 2) 감지 (AI) ───────────────────────────── */
/* CSV는 여기서 실제로 파싱한다.
 * 관계 추론에 필요한 열(날짜·적요·금액)만 화이트리스트로 남기고, 계좌번호·잔액·거래점 같은 나머지 열은 버린다.
 * 적요 안에 계좌·카드번호 꼴의 숫자가 있으면 마스킹한다. 이 결과만 모델로 전송된다. */
const CSV_MAX_ROWS = 300;
const COL = {
  date: /일자|날짜|date|거래일/i,
  memo: /적요|내용|메모|비고|memo|desc/i,
  amt: /금액|입금|출금|amount|amt/i,
};
const splitLine = (l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).filter((_, i, a) => i < a.length - 1 || _ !== '');
const maskDigits = (s) => s.replace(/\d[\d-]{8,}\d/g, (m) => m.slice(0, 3) + '***');
function setCsv(text, label) {
  const rows = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) {
    $('#csvInfo').innerHTML = `<b>${esc(label)}</b> — 거래가 없습니다. 헤더와 1건 이상이 필요합니다.`;
    $('#runRelation').disabled = true; state.csv = null; return;
  }
  const header = splitLine(rows[0]);
  const idx = { date: [], memo: [], amt: [] };
  header.forEach((h, i) => { for (const k in COL) if (COL[k].test(h)) idx[k].push(i); });
  if (!idx.memo.length) {
    $('#csvInfo').innerHTML = `<b>${esc(label)}</b> — 적요(거래내용) 열을 찾지 못했습니다. 헤더에 "적요"가 있는 CSV를 올려주세요.`;
    $('#runRelation').disabled = true; state.csv = null; return;
  }
  const keep = [...idx.date, ...idx.memo, ...idx.amt];
  const body = rows.slice(1, 1 + CSV_MAX_ROWS).map((l) => {
    const c = splitLine(l);
    const q = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
    return keep.map((i) => q(idx.memo.includes(i) ? maskDigits(c[i] ?? '') : (c[i] ?? ''))).join(',');
  });
  state.csv = [keep.map((i) => header[i]).join(','), ...body].join('\n');
  const dropped = header.filter((_, i) => !keep.includes(i));
  const cut = rows.length - 1 > CSV_MAX_ROWS ? ` (앞 ${CSV_MAX_ROWS}건만 사용)` : '';
  $('#csvInfo').innerHTML = `<b>${esc(label)}</b> — 거래 ${body.length}건${cut}. 전송되는 열: <b>${esc(keep.map((i) => header[i]).join(' · '))}</b>`
    + (dropped.length ? ` / 버린 열: ${esc(dropped.join(' · '))}` : '')
    + `. 적요의 계좌·카드번호 꼴 숫자는 마스킹됩니다. 서버에 저장하지 않으며, 관계 추론을 위해 생성형 AI(Google Gemini API)로 1회 전송됩니다.`;
  $('#runRelation').disabled = false;
}
$('#csvFile').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    // 국내 은행 CSV는 CP949(EUC-KR)가 많다. UTF-8로 못 읽으면 EUC-KR로 다시 읽는다.
    const buf = rd.result; let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch { text = new TextDecoder('euc-kr').decode(buf); }
    setCsv(text, f.name);
  };
  rd.readAsArrayBuffer(f);
};
$('#useSampleCsv').onclick = async () => {
  const t = await (await fetch('/sample-transactions.csv')).text();
  setCsv(t, 'sample-transactions.csv (심사용 샘플)');
};

$('#runRelation').onclick = async () => {
  const box = $('#relationOut'); box.hidden = false;
  box.innerHTML = `<div class="card"><p class="loading">거래 적요를 읽고 관계를 추론하는 중입니다</p></div>`;
  try {
    const r = await callAI('relation', { transactions: state.csv });
    state.relations = r.candidates;
    const conf = (c) => `<span class="tag ${c === '높음' ? 'hi' : c === '낮음' ? 'lo' : ''}">신뢰도 ${esc(c)}</span>`;
    box.innerHTML = `<div class="card result">
      <h3>감지된 관계 <span class="ai-badge">생성형 AI</span></h3>
      <p class="hint">${esc(r.summary)}</p>
      ${r.candidates.map((c) => `
        <div class="flowrow">
          <div class="who"><span class="nm">${esc(c.counterparty)}</span>
            <span class="rel">${esc(c.inferred_relation)}</span>${conf(c.confidence)}</div>
          <div class="amt">${won(c.total_amount)}</div>
          <div class="reason" style="color:var(--muted)">${esc(c.evidence)} · 관측 ${c.months_observed}개월</div>
        </div>`).join('')}
      <ul class="notes">
        <li>이 추론은 <b>추정</b>입니다. 거래내역만으로 법정상속인 여부를 알 수 없으며, 확정은 사용자가 합니다.</li>
        <li>여기 없는 사람이 관계가 아니라는 뜻은 아닙니다. 빠진 분은 1단계에서 직접 추가하세요.</li>
        <li>AI가 상속인을 정하지 않습니다. 상속 순위는 강행규정이며, 이 화면은 <b>지정을 촉발</b>할 뿐입니다.</li>
      </ul></div>`;
    fillTargets();
    markDone(2);
    runDiagnose();
  } catch (e) { showErr(box, e.message, () => $('#runRelation').click()); }
};

/* 감지된 관계 + 법정 계산 결과 → 개인별 진단 서술 (AI). 1단계 계산을 마친 뒤에만 의미가 있다. */
async function runDiagnose() {
  const box = $('#diagnoseOut'); box.hidden = false;
  if (!state.statutory) {
    box.innerHTML = `<div class="card"><p class="hint">1단계에서 자산·관계를 먼저 계산하면, 감지된 관계와 법정 구도가 어긋나는 지점을 여기서 서술합니다.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="card"><p class="loading">감지된 관계와 법정 구도를 대조해 서술하는 중입니다</p></div>`;
  try {
    const s = state.statutory;
    const r = await callAI('diagnose', {
      statutory: { estate: s.estate, topOrderLabel: s.topOrderLabel, heirs: s.heirs, excluded: s.excluded, reservedTotal: s.reservedTotal, freeDisposable: s.freeDisposable },
      relations: state.relations,
    });
    box.innerHTML = `<div class="card result">
      <h3>지금 상태로는 <span class="ai-badge">생성형 AI</span></h3>
      <p class="headline">${esc(r.headline)}</p>
      <p>${esc(r.body)}</p>
      <p><b>어긋나는 지점</b> — ${esc(r.gap)}</p>
      ${r.law_change_note ? `<p class="hint">개정 민법(2026-03-17 시행) 영향: ${esc(r.law_change_note)}</p>` : ''}
      <p class="hint">⚠ ${esc(r.caution)}</p>
    </div>`;
  } catch (e) { showErr(box, e.message, runDiagnose); }
}

/* ── 3) 지정 설계 (AI) ──────────────────────── */
function fillTargets() {
  const s = state.statutory; if (!s) return;
  const opts = s.people.map((p) =>
    `<option value="${esc(p.name)}"${p.relation === 'partner' ? ' selected' : ''}>${esc(p.name)} (${esc(RELATIONS[p.relation])})</option>`);
  // 2단계에서 AI가 감지한 상대 중 1단계 목록에 없는 사람도 지정 후보로 올린다 — 감지가 지정으로 이어지게.
  const known = new Set(s.people.map((p) => p.name.replace(/\(.*\)/, '').trim()));
  for (const c of state.relations || []) {
    if (['생계공유', '정기부양'].includes(c.inferred_relation) && !known.has(c.counterparty)) {
      opts.push(`<option value="${esc(c.counterparty)}">${esc(c.counterparty)} (거래내역에서 감지 · ${esc(c.inferred_relation)})</option>`);
    }
  }
  $('#targetPerson').innerHTML = opts.join('');
}
$('#runDraft').onclick = async () => {
  if (!state.statutory) return toast('먼저 1단계 진단을 실행하세요.');
  const box = $('#draftOut'); box.hidden = false;
  box.innerHTML = `<div class="card"><p class="loading">자산별 지정 수단을 매칭하고 실행 문구를 작성하는 중입니다</p></div>`;
  const tools = Object.fromEntries(state.statutory.assets.map((a) => [a.typeLabel, DESIGNATION_TOOLS[a.type]]));
  try {
    const r = await callAI('draft', {
      target: $('#targetPerson').value,
      relationship: $('#targetRelationship').value || '함께 생활해 온 관계',
      assets: state.statutory.assets, tools,
      statutory: { heirs: state.statutory.heirs, excluded: state.statutory.excluded, freeDisposable: state.statutory.freeDisposable },
      relations: state.relations || [],
    });
    state.draft = r;
    box.innerHTML = `<div class="card result">
      <h3>실행 설계 <span class="ai-badge">생성형 AI</span></h3>
      ${r.actions.map((a) => `
        <div style="border-bottom:1px solid var(--line);padding:16px 0">
          <h3>${esc(a.asset_label)} → ${esc(a.tool)}</h3>
          <p class="hint">근거: ${esc(a.legal_basis)}</p>
          <ol class="steplist">${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
          <pre class="draft">${esc(a.draft_text)}</pre>
          <p class="hint">⚠ ${esc(a.caveat)}</p>
        </div>`).join('')}
      <div style="padding-top:16px">
        <h3>관계 소명 자료 초안</h3>
        <p class="hint">수익자 지정·신탁 계약 등 금융기관에 관계를 설명해야 하는 자리에 쓰는 초안입니다. 보관해 두면 나중에 관계를 증명할 때 근거가 됩니다.</p>
        <pre class="draft">${esc(r.relationship_statement)}</pre>
      </div>
      <div class="actions" style="margin-top:16px"><button class="ghost" id="copyAll" type="button">전체 복사</button></div>
    </div>`;
    $('#copyAll').onclick = () => {
      const head = '[이 문서는 생성형 AI가 작성한 초안입니다. 법률 자문이 아니며, 제출 전 해당 금융기관·전문가의 확인이 필요합니다.]\n\n';
      const body = $$('#draftOut pre').map((p) => p.textContent).join('\n\n---\n\n');
      navigator.clipboard.writeText(head + body + '\n\n— 「한 사람」 자동 생성 초안')
        .then(() => toast('복사했습니다. 맨 위에 AI 초안 표시가 함께 들어갑니다.'))
        .catch(() => toast('복사하지 못했습니다. 본문을 직접 선택해 복사하세요.'));
    };
    renderSummary(); markDone(3);
  } catch (e) { showErr(box, e.message, () => $('#runDraft').click()); }
};

/* ── 4) 요약 ────────────────────────────────── */
function renderSummary() {
  const s = state.statutory; if (!s) return;
  const target = $('#targetPerson').value;
  $('#summaryOut').innerHTML = `<div class="card result">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
      <div><h3>지정 전 — 법이 정한 순서</h3>
        ${[...s.heirs, ...s.excluded].map((h) => `<div class="flowrow${h.amount ? '' : ' zero'}">
          <div class="who"><span class="nm">${esc(h.name)}</span></div><div class="amt">${won(h.amount)}</div></div>`).join('')}</div>
      <div><h3>지정 후 — 내가 정한 순서</h3>
        <p class="hint"><b>${esc(target)}</b>님께 최대 <b>${won(s.freeDisposable)}</b>까지 갈 수 있습니다
        (총재산 ${won(s.estate)} − 유류분 합계 ${won(s.reservedTotal)}, 유류분 청구가 있을 때를 기준으로 한 하한).</p>
        <p class="hint">보험은 수익자로 지정하면 원칙적으로 수익자의 고유재산으로 보아 <b>상속재산 분할 대상에서 제외</b>됩니다. 다만 상속세는 과세되며, 유류분 산정에서 다투어질 수 있습니다.</p></div>
    </div>
    <ul class="notes">
      <li>지정 없이 두면 위 왼쪽 그림이 그대로 실행됩니다.</li>
      <li>유류분은 2026-03-17 시행 개정 민법에 따라 재산 자체가 아니라 <b>가액(금전)</b>으로 반환합니다.</li>
    </ul></div>`;
}
$('#runAsk').onclick = async () => {
  const q = $('#askInput').value.trim(); if (!q) return;
  const box = $('#askOut');
  box.innerHTML = `<p class="loading">답변을 작성하는 중입니다</p>`;
  try {
    const r = await callAI('ask', { question: q, context: state.statutory ? { heirs: state.statutory.heirs, excluded: state.statutory.excluded } : {} });
    box.innerHTML = `<div style="margin-top:14px"><p>${esc(r.answer)}</p>
      <dl class="kv"><dt>되는 것</dt><dd><ul class="notes">${r.can_do.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>
      <dt>안 되는 것</dt><dd><ul class="notes">${r.cannot_do.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd></dl></div>`;
    markDone(4);
  } catch (e) { showErr(box, e.message, () => $('#runAsk').click()); }
};

/* ── 공통 ───────────────────────────────────── */
async function callAI(task, input) {
  const res = await fetch('/api/ai', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, input }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `요청 실패 (${res.status})`);
  return j.result;
}
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3200);
}
function markDone(n) { $(`#stepnav li[data-step="${n}"]`)?.classList.add('done'); }
function go(n) {
  state.step = Math.min(4, Math.max(1, n));
  $$('.panel').forEach((p, i) => { p.hidden = i + 1 !== state.step; });
  $$('#stepnav li').forEach((li) => li.classList.toggle('on', +li.dataset.step === state.step));
  $('#prevBtn').hidden = state.step === 1;
  $('#nextBtn').hidden = state.step === 4;
  if (state.step === 3) fillTargets();
  if (state.step === 4) renderSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$('#prevBtn').onclick = () => go(state.step - 1);
$('#nextBtn').onclick = () => go(state.step + 1);
$$('#stepnav li').forEach((li) => { li.style.cursor = 'pointer'; li.onclick = () => go(+li.dataset.step); });

$('#assets tbody').append(assetRow({ type: 'deposit' }));
$('#people tbody').append(personRow({ relation: 'partner' }));
syncTotal(); go(1);
