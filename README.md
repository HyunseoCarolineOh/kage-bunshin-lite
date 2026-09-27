# kage-bunshin-lite (그림자 분신술 필수판)

**English summary.** kage-bunshin-lite turns a plain-text event brief into a branded eDM/newsletter HTML file.
A React page sends the brief to a Lambda API; the API asks Amazon Bedrock (Claude, forced tool call) for a JSON "spec"
that must fit the slots of a template schema (per-slot character limits, allowed layouts); the browser then assembles
spec + template into email-safe HTML you can copy into a mail client or download with images inlined.
Design lives entirely in a *theme folder* (`templates/<theme>/`): tokens, HTML skeleton, layout variants, slot schema,
brand-specific prompt guidance and image assets. The AI only writes copy. A neutral theme, `sample` ("Northwind Cloud"),
is committed; point `THEME=<folder>` at your own theme to rebrand without touching the code. Infra is a small CDK stack
(S3 + CloudFront, API Gateway HTTP API, Lambda, DynamoDB). MIT licensed.

---

원고를 붙이면 브랜드 템플릿에 맞춘 eDM HTML이 나온다. 디자인은 테마 폴더가 맡는다. AI는 글만 쓴다.

## 흐름

```
브라우저(web/)  ── POST /generate ──▶  Lambda(lambda/api/)  ──▶  Amazon Bedrock (Claude, 강제 도구 호출)
      ▲                                   │  validateSpec → 글자수 위반 칸 1회 수선
      │   스펙 JSON + 템플릿 HTML          ▼
   조립기(assembler)  ◀── 초안 저장 PUT/GET /flyers/{id} (DynamoDB)
      │
      ▼  HTML 복사(메일 붙이기) · HTML 내려받기(이미지 내장)
```

1. 원고 입력 → `POST /generate` 한 번. API Gateway 30초 안에 끝낸다.
2. Bedrock이 스펙 JSON을 도구 호출로 제출한다. 스펙은 `schema.v2.json`의 슬롯 계약(글자수·줄수·형태)을 따른다.
3. `validateSpec`이 어긴 칸을 찾고 그 칸만 다시 쓰게 한 번 수선한다.
4. 브라우저가 스펙 + 테마 템플릿을 조립한다. 글자를 클릭해 고치면 2초 뒤 자동 저장.
5. 내보내기. HTML 복사(메일 편집기에 붙이기), HTML 내려받기(이미지 data URI 내장).

## 폴더

```
theme.config.mjs      활성 테마 선택 (THEME 환경변수 → .env → 기본 sample)
templates/sample/     공개 샘플 테마 "Northwind Cloud" (가상 회사)
templates/<mine>/     내 브랜드 테마 (git-ignored로 두고 THEME=<mine>으로 지정)
web/                  React SPA — HomePage(원고 입력) · EditorPage(클릭 편집) · lib/(assembler·validator·spec·template·themes)
lambda/api/           handler.mjs(라우트 2개) · prompt.mjs · shared/ templates/ 는 sync:templates가 만드는 사본
infra/                CDK 스택 KageBunshinLite (S3·CloudFront·API Gateway·Lambda·DynamoDB)
scripts/              template:build(테마 빌드) · sync-templates · local-api(로컬 브리지) · e2e · edit-rate
```

`web/src/lib/*.js`와 `templates/<theme>/`가 단일 소스다. `lambda/api/shared/`, `lambda/api/templates/`는 직접 고치지 않는다.

## 테마 시스템

테마 하나가 폴더 하나다. 빌드 스크립트와 앱은 아래 파일만 본다.

| 파일 | 역할 | 필수 키 |
|---|---|---|
| `theme.mjs` | 테마 설명서 (default export) | `id`, `name`, `defaultVariant`, `variants{ id: { label, accent, end, tint, chartBg } }`, `logoWhite{ id, file }`, `brandLabels{}`; 선택 `icons{}`, `legacyBackgrounds[]`, `sampleBrief`, `variants.*.keywords[]` |
| `tokens.json` | 디자인 토큰 (`{{color.ink}}`처럼 참조) | `color.*`, `gradient.accent`, `font.stack`, `font.label`, `radius.*`, `shadow.*`, `style.*` |
| `template.src.html` | 640px 테이블 기반 HTML 골격. `data-slot`·`data-section`·`data-repeat` 규약 | 섹션 `hero`~`footer` 13개 (`schema.json`의 `sections`와 같은 이름) |
| `v2-layouts.mjs` | 섹션별 형태(layout) 마크업 | `export const layouts`, `export const refits` |
| `schema.json` | v1 슬롯 계약 (글자수·기본값·브랜드·이미지 프리셋) | `sections`, `meta.docTitle`, `brands`(`none` 포함), `imageSlots{ heroBg, logo, photo }`, `iconPresets` |
| `prompt-style.md` | 이 뉴스레터 고유의 브랜드 표기·말투 지침. 시스템 프롬프트에 그대로 들어간다 | 자유 서식 |
| `assets/` | 이미지 | `hero-<variant>.jpg`(1280×569), `hero-deco-<variant>.png`(480×720), `logoWhite.file`, `imageSlots`·`iconPresets`가 가리키는 파일 |

빌드 산출물(`template.html`, `schema.v2.json`, `generated/v2-<variant>.html`)은 `npm run template:build`가 만든다. 샘플 테마는 산출물도 함께 커밋해 두었다.

### 내 테마 만들기

```bash
cp -r templates/sample templates/acme          # 복사해서 시작
echo "templates/acme/" >> .gitignore           # 비공개 브랜드면 커밋하지 않는다
echo "THEME=acme" >> .env                      # 또는 매번 THEME=acme npm run ...
# templates/acme/ 의 theme.mjs · tokens.json · schema.json 기본 문구 · prompt-style.md · assets/ 를 바꾼다
npm run template:build                         # template.html · schema.v2.json · generated/ 생성
npm run dev                                    # 미리보기
```

- 색 변형(`variants`)은 편집기 위쪽의 색 점이 된다. AI는 항상 `defaultVariant`로 뽑고 사용자가 바꾼다.
- 배경·장식 이미지는 이름 규약을 따른다. `hero-<variant>.jpg`, `hero-deco-<variant>.png`.
- 제품 브랜드(워드마크 색·아이콘)는 `schema.json → brands`에 두고 공식 표기는 `theme.mjs → brandLabels`에 적는다. 프롬프트 안내문은 여기서 자동으로 만들어진다.
- 말투·브랜드 표기 규칙처럼 회사 고유의 지침은 `prompt-style.md`에만 쓴다. `lambda/api/prompt.mjs`는 테마와 무관한 규칙만 담는다.

## 실행

```bash
npm install && npm install --prefix web && npm install --prefix infra

# 테마 빌드 (기본 sample. 다른 테마는 THEME=<folder> 또는 .env)
npm run template:build

# 로컬. Bedrock은 실제 호출(로컬 AWS 자격증명 필요), 저장은 메모리
export AWS_REGION=ap-northeast-2                # Bedrock을 호출할 리전
npm run local                                   # sync:templates → http://127.0.0.1:8787
LOCAL_API=http://127.0.0.1:8787 npm run dev     # http://127.0.0.1:5173

# E2E (헤드리스 크롬, 실제 생성 1회)
npm run e2e                                     # 또는 node scripts/e2e.mjs https://<배포 도메인>
```

## 배포

```bash
npm run deploy      # sync:templates → vite build → cdk deploy (출력: infra/deployment-outputs.json)
```

CDK 스택 하나(`KageBunshinLite`)가 S3 정적 사이트, CloudFront(`/api/*`는 API Gateway로), Lambda(Node 22), DynamoDB 테이블(`kage-bunshin-lite`)을 만든다. 계정·리전은 CDK 기본 자격증명을 따르고 `AWS_REGION`으로 바꿀 수 있다.

Lambda 환경변수 (`infra/lib/kage-bunshin-lite-stack.ts`):

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `MODEL_ID` | `global.anthropic.claude-sonnet-4-6` | 1차 모델 |
| `FALLBACK_MODEL_ID` | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | 1차 실패 시 |
| `GENERATE_BUDGET_MS` | `26000` | 생성 전체 마감 (API Gateway 30초 안) |
| `DEFAULT_THEME` | 테마의 `defaultVariant` | AI가 뽑는 색 변형 |
| `TABLE` | 스택이 주입 | DynamoDB 테이블 |

공개 링크로 열 계획이면 일일 상한(요청 수 제한) 하나는 붙이고 여는 것을 권한다. 이 저장소에는 없다.

## 품질 지표: 수정률

생성 직후 첫 저장에만 AI 원본이 `aiSpec`으로 함께 저장된다. 사람이 고친 칸의 비율이 곧 AI가 의도를 놓친 양이다.

```bash
npm run edit-rate                        # 운영 테이블 전체 → scripts/edit-rate-out/<날짜>.md
npm run edit-rate -- --since 2026-10-01
node scripts/edit-rate.mjs --api http://127.0.0.1:8787 --ids <id>
```

## 라이선스

MIT. `LICENSE` 참고.
