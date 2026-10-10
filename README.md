# 「한 사람」 — 지정 수취인 진단·설계 서비스

2026 금융 AI Challenge 출품작 (1인) · 2026-09-06 제출 · 발표심사 대상(11팀)에는 선정되지 않았습니다.

> 상속은 법이 정한 순서로 흐른다. 이 서비스는 내가 정한 사람에게 흐르게 한다.

## 구조

```
public/
├── index.html               4단계 단일 페이지
├── app.js                   화면 로직 (ES 모듈)
├── style.css                라이트/다크 대응
├── lib/inheritance.js       ★ 법정상속 계산 엔진 (결정론적, AI 미사용)
└── sample-transactions.csv  심사자용 샘플 거래내역
api/ai.js                    생성형 AI 엔드포인트 (Vercel 서버리스, 4개 task)
scripts/verify-inheritance.mjs  계산 엔진 전수 검산
scripts/smoke-ai.mjs         AI 4개 task 호출 점검
package.json / vercel.json
```
**설계 원칙: 계산은 규칙, 해석은 AI.** 법정상속분은 결정론적 계산이므로 규칙 엔진이 하고,
생성형 AI는 비정형 자연어(거래 적요 해석·개인별 서술·문서 작성·질의응답)만 담당한다.

## 법령 기준

민법(법률 제21454호, **2026-03-17 공포·시행**) 제1000·1003·1004조의2·1009·1057조의2·1112조,
신탁법 59조, 상법 733조.
형제자매 유류분(1112조 4호)은 헌재 2024-04-25 결정으로 **효력 상실**.
유류분 반환은 2026년 개정으로 **가액(금전) 반환**.
상속권 상실 선고(1004조의2)는 2026-01-01 시행, 제21454호 개정으로 전 상속인에 적용된다.

## 계산 엔진 검산

**전수 검산:** `npm run verify` — 가족 구성 864가지 × 재산 11구간 = **9,504 케이스**를 조문별 6개 항목(1009조 합계·배우자 가산, 1000조 최근친 우선, 1112조 유류분, 1003조 형제자매 배제, 사실혼 파트너 표시)으로 확인한다. 2026-10-10 이 저장소의 엔진으로 실행해 실패 0을 확인했다. 엔진(`public/lib/inheritance.js`)은 제출본(2026-09-06)에서 바뀌지 않았다.

아래는 대표 케이스를 한 번에 돌려 보는 예시다.

```bash
node --input-type=module -e "import('./public/lib/inheritance.js').then(m=>{
  const P=(i,n,r)=>({id:i,name:n,relation:r});
  console.log(m.computeStatutory([P('1','정○○','partner'),P('2','김○자','parent'),P('3','이복형','sibling')],224000000));
})"
```

| 케이스 | 기대값 | 상태 |
|---|---|---|
| 배우자 + 자녀2 | 3/7 · 2/7 · 2/7 (1009조 배우자 5할 가산) | ✅ |
| 배우자 + 부모 | 3/5 · 2/5 | ✅ |
| 배우자 + 형제자매 | 배우자 100%, 형제 0원 (1003조) | ✅ |
| 형제자매만 | 균분, **유류분 0** (1112조 4호 실효) | ✅ |
| 사실혼 파트너 + 부모 + 형제 | 부모 100%, 파트너·형제 0원 (사유 표시) | ✅ |

## 실행

데모: **https://han-saram.vercel.app**

```bash
npm install
npm run verify                     # 법정상속 계산 엔진 전수 검산 (AI·키 불필요)
GEMINI_API_KEY=... npm run smoke   # 생성형 AI 4개 task 실제 호출
```

AI 공급자는 `api/ai.js`가 환경변수로 고른다. `GEMINI_API_KEY`가 있으면 Gemini, 없고 `ANTHROPIC_API_KEY`가 있으면 Claude.
`AI_PROVIDER=gemini|anthropic`로 강제할 수 있고, 모델은 `GEMINI_MODEL` / `ANTHROPIC_MODEL`로 바꾼다.

## 하지 않는 것

AI가 상속인을 판정하지 않는다 · 자산을 이동시키지 않는다 · 사망 후 지급을 집행하지 않는다 · 법률 자문이 아니다.
