# 「한 사람」 — 지정 수취인 진단·설계 서비스

2026 금융 AI Challenge 출품작 (팀 SBK, 1인) · 마감 **2026-09-07(월) 10:00**

> 상속은 법이 정한 순서로 흐른다. 이 서비스는 내가 정한 사람에게 흐르게 한다.

## 구조

```
app/
├── public/
│   ├── index.html               4단계 단일 페이지
│   ├── app.js                   화면 로직 (ES 모듈)
│   ├── style.css                라이트/다크 대응
│   ├── lib/inheritance.js       ★ 법정상속 계산 엔진 (결정론적, AI 미사용)
│   └── sample-transactions.csv  심사자용 샘플 거래내역
├── api/ai.js                    생성형 AI 엔드포인트 (Vercel 서버리스, 4개 task)
├── package.json / vercel.json
```

**설계 원칙: 계산은 규칙, 해석은 AI.** 법정상속분은 결정론적 계산이므로 규칙 엔진이 하고,
생성형 AI는 비정형 자연어(거래 적요 해석·개인별 서술·문서 작성·질의응답)만 담당한다.

## 법령 기준

민법(법률 제21454호, **2026-03-17 공포·시행**) 제1000·1003·1009·1112·1057조의2조,
신탁법 59조, 상법 733조.
형제자매 유류분(1112조 4호)은 헌재 2024-04-25 결정으로 **효력 상실**.
유류분 반환은 2026년 개정으로 **가액(금전) 반환**.

## 계산 엔진 검산

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

## 배포 (남은 작업)

**필요한 것 2개 — 사용자만 할 수 있음**

1. **Gemini API 키** — aistudio.google.com 로그인 → Get API key (카드 등록 없음, 무료 티어)
2. **Vercel 계정** — GitHub 계정으로 로그인 가능

```bash
cd ~/Downloads/해커톤/AI\ challenge/app
npm i -g vercel        # 또는  npx vercel
vercel login
vercel env add GEMINI_API_KEY production   # 키 붙여넣기
vercel --prod
```

AI 공급자는 `api/ai.js`가 환경변수로 고른다. `GEMINI_API_KEY`가 있으면 Gemini, 없고 `ANTHROPIC_API_KEY`가 있으면 Claude.
`AI_PROVIDER=gemini|anthropic`로 강제할 수 있고, 모델은 `GEMINI_MODEL` / `ANTHROPIC_MODEL`로 바꾼다.

배포 전 로컬 확인:

```bash
GEMINI_API_KEY=... npm run models   # 이 키로 쓸 수 있는 모델 목록
GEMINI_API_KEY=... npm run smoke    # 4개 task 실제 호출
```

배포 후 `docs/기능명세서_한사람_v1.md`의 **배포 URL** 칸을 채운다.

### ⚠️ 결격 회피 체크리스트

- [ ] URL이 **2026-09-11(금) 23:59까지** 살아 있어야 한다. 끊기면 **결격**
- [ ] 배포 후 검증 1~6(기능명세서 §5-2)을 실제 URL에서 전부 돌려본다
- [ ] Gemini 무료 티어 한도(분당 10~15회)를 넘기지 않는다. 심사 기간엔 여유가 크지만, 검증은 배포 직후 한 번에 몰아서 하지 말 것
- [ ] 다른 브라우저(Chrome/Safari)에서 각각 확인

## 하지 않는 것

AI가 상속인을 판정하지 않는다 · 자산을 이동시키지 않는다 · 사망 후 지급을 집행하지 않는다 · 법률 자문이 아니다.
