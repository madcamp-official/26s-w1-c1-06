# 지각비 주식 시장 (Latestock)

**공통과제 I : 웹 기반 프로젝트 (2인 1팀)** — `26s-w1-c1-06`

친구의 시간 약속 준수를 가상의 "주식"으로 표현하고, GPS 기반 도착 인증 결과가 약속 단위로 주가에 반영되는 소셜 게임형 웹 서비스입니다. 친구가 약속에 늦으면 그 친구의 주가가 내려가고, 정시에 도착하면 올라갑니다. 다른 친구들은 "이 친구가 늦을지 안 늦을지"에 가상 포인트를 걸고 투자(매수)하거나 공매도합니다.

> 이 서비스는 "지각을 실제로 줄이겠다"고 약속하지 않습니다. 아무도 공식적으로 다루지 않던 '시간 약속'이라는 사회적 규칙을, 처벌이 아니라 게임으로 표면 위에 올리는 것이 목적입니다.

---

## 팀원

| 이름 | GitHub | 역할 |
|---|---|---|
|  |  |  |
|  |  |  |

---

## 기획안

- **주제:** 친구의 지각/정시 여부를 가상 주식으로 만들어 서로 투자·공매도하는 소셜 게임
- **목적:** 처벌이 아니라 게임으로 "지각"이라는 사회적 문제를 눈에 보이게 만든다. 주가는 오직 GPS 인증에 기반한 약속 판정 결과로만 움직이며(랜덤 변동 없음), 늦길 바라는 힘(공매도)과 정시를 바라는 힘(매수·자기 방어)이 공존하는 양방향 시장을 만든다.
- **핵심 기능:**
  - 친구 요청/수락(동의 기반) → 상호 종목 조회·베팅 권한 성립
  - 약속 생성 + 초대 응답(수락자만 판정·베팅 대상)
  - GPS 기반 도착 인증(반경 50m) → 정시/지각/노쇼 판정
  - 약속 단위 자동 정산(1분 주기 스케줄러, 멱등) → 주가 변동 + 포지션 손익 정산
  - 친구의 특정 약속에 대한 매수(정시 베팅)/공매도(지각 베팅) 포지션
  - 자기 주식 특례: 정시 도착 시 방어 보상 + 스톡옵션형 특별매수 권한, 취득 후 손절 불허 매도
  - 주가 차트, 자산 현황, 정산 결과 공유 카드(밈 톤, 이니셜 마스킹)
  - (선택) ETF 바스켓, 옵션(콜/풋), 레버리지 베팅, 랭킹, 알림, 이모지 리액션 등
- **예상 사용자:** 친구·지인 그룹 단위로 약속이 잦고, 그중 지각이 잦은 친구가 있는 20대 전후 사용자. 실제 화폐가 걸리지 않는 가상 포인트 기반 유머 게임이므로 친밀한 소규모 그룹 사용을 전제로 한다.
- **팀원별 역할:**

---

## 기능 명세서

> 전체 상세 명세(설계 원칙 P-1~P-5, 핵심 개념 정의, Given–When–Then 수용 기준 등)는 [`claude/기능 명세서.txt`](<./claude/기능 명세서.txt>) (v7) 참고.

### 설계 원칙

| ID | 원칙 | 설명 |
|---|---|---|
| P-1 | 가시화 우선 | 주가는 오직 약속 판정 결과로만 변동(랜덤 없음) |
| P-2 | 양방향 시장 | 공매도(지각 베팅)와 매수(정시 베팅)가 동등하게 공존 |
| P-3 | 동의 기반 | 친구 수락 + 약속 초대 수락, 이중으로 동의를 전제 |
| P-4 | 톤 가드레일 | 모든 문구는 유머 톤, 인신공격 금지 |
| P-5 | 자기 주식 특례 | 평상시 자기 주식 매수/공매도 불가, 정시 도착 시에만 제한된 매수 권한 |

### 필수 기능 (1차, MVP)

- [x] F-01 회원가입 / 로그인 / 로그아웃 (가입 시 주식 자동 발행)
- [x] F-02 친구 요청 & 수락
- [x] F-03 친구(종목) 목록 조회
- [x] F-04 약속 생성
- [x] F-19 약속 초대 응답 (수락/거절)
- [x] F-05 GPS 도착 인증 (반경 50m)
- [x] F-06 지각 판정 (정시/지각/노쇼)
- [x] F-07 주가 변동 (약속 단위 정산, 모델 B)
- [x] F-08 주가 히스토리 저장
- [x] F-09 가상 포인트 지급
- [x] F-10 매수 포지션 (정시 베팅)
- [x] F-11 공매도 포지션 (지각 베팅)
- [x] F-12 자동 정산 (1분 폴링 스케줄러, 멱등)
- [x] F-13 주가 차트 조회
- [x] F-14 내 자산 현황
- [x] F-15 정시 방어 보상
- [x] F-16 데모 모드 (위치/시각 override, 정산 강제 실행)
- [x] F-17 자기 주식 특별 매수 (스톡옵션형, 행사 시점 현재가)
- [x] F-18 자기 주식 매도 (손절 불허)
- [x] F-20 정산 결과 공유 카드 (이니셜 마스킹)

### 선택 기능 (2차, 확장)

- [x] S-01 정시 연속 기록 / 명예 배지
- [ ] S-02 실시간 위치 공유
- [x] S-03 ETF(묶음 펀드)
- [x] S-04 옵션 거래 (콜/풋)
- [x] S-05 레버리지 베팅
- [x] S-06 랭킹 / 커뮤니티
- [x] S-07 알림 센터
- [x] S-08 정산 전 포지션 취소
- [x] S-09 이모지 리액션
- [x] L-01 동적 프리미엄 산정 (EWMA, α=0.25)
- [x] L-02 청산 조건 고지 (레버리지)

---

## IA 및 화면 설계서

> 전체 사이트맵·화면 흐름·화면별 상세 와이어프레임 명세는 [`claude/IA_화면설계서_v2.1.xlsx`](<./claude/IA_화면설계서_v2.1.xlsx>) 참고. 총 24개 화면(1차 18개, 2차 6개) + 개발용 데모 화면 1개.

**플랫폼 가정:** 모바일 우선(GPS·위치 기반) 반응형 웹. 하단 탭 5개(홈·약속·시장·자산·더보기) + 상세/모달.

### 사이트맵 (탭 구조)

| 탭 | 랜딩 화면 | 주요 하위 화면 |
|---|---|---|
| 홈 | SC-03 홈 대시보드 | 미확인 정산 배너, 내 종목 요약, 친구 종목 카드 |
| 약속 | SC-07 약속 목록 | SC-08 약속 생성 · SC-09 약속 상세/GPS 인증 · SC-10 정산 결과 |
| 시장 | SC-04 종목 리스트 | SC-05/06 친구 추가·수신함 · SC-11 종목 상세(타인) · SC-12/13 매수·공매도 모달 · SC-14 내 종목(자기주식) · SC-17 ETF · SC-18 옵션 · SC-19 레버리지 |
| 자산 | SC-15 내 자산 현황 | SC-16 포지션/정산 내역 · SC-20 포지션 취소 |
| 더보기 | SC-25 더보기 메뉴 | SC-21 랭킹 · SC-22 프로필/배지 · SC-23 알림 센터 · SC-24 데모 모드 · 로그아웃 |
| 진입(비로그인) | SC-01 로그인 | SC-02 회원가입 |

### 핵심 화면 흐름

로그인 → 친구 수락(SC-06) → 약속 생성(SC-08) → 초대 수락(F-19, SC-07/09) → 매수·공매도 베팅(SC-12/13, 베팅 마감 = 약속 시각) → GPS 인증(SC-09) → **(백엔드) 자동 정산 스케줄러** → 미확인 정산 배너(SC-03/15) → 정산 결과 확인 및 공유(SC-10, SC-16)

- 약속 시각 전에는 타인의 도착 인증 여부가 마스킹되어(R-1) 확정 정보로 무위험 베팅이 불가능하도록 설계됨.
- 자기 종목(SC-11) 접근 시 SC-14(내 종목)로 자동 리다이렉트되어 자기 주식 특례(P-5)가 화면 단에서도 보장됨.
- 정산·EWMA 배치·초대 자동 거절은 화면이 없는 백엔드 컴포넌트이며, 검증 진입점은 SC-24(데모 모드)의 "정산 강제 실행" 버튼.

---

## DB 스키마

> 전체 DDL 원본은 [`db/schema.sql`](./db/schema.sql) 참고 (PostgreSQL 16). 게임 규칙 중 반드시 지켜야 하는 불변식은 CHECK/UNIQUE 제약으로 DB 레벨에서 보장한다.

### 테이블 개요

| 테이블 | 역할 |
|---|---|
| `users` | 계정 + 종목(1인 1주식·전역 단일가) + 지갑을 병합. 현재가·지각확률(EWMA)·연속 정시 스트릭 포함 |
| `friendships` | 친구 요청/수락(조회·베팅 권한의 전제, F-02) |
| `promises` | 약속(장소·시각·정산 마감 시각) |
| `promise_participants` | 약속 초대 응답·GPS 인증·판정·정산가를 한 행에 기록 (별도 가격 히스토리 테이블 없이 겸용) |
| `positions` | 유저-종목-약속 단위 매수/공매도 포지션, 잠금 포인트·손익·레버리지 배수 |
| `etf_orders` | ETF 바스켓 헤더(구성 leg는 `positions.etf_order_id`로 태깅) |
| `self_stock_options` | 정시 도착으로 발급되는 자기 주식 특별매수 권한(F-17) |
| `self_stock_lots` | 취득한 자기주식(취득 단위, 손절 불허) |
| `point_transactions` | 포인트 원장 — `users.available_points` = 유저별 합계와 항상 일치해야 함 |
| `reactions` | 정산 결과 이모지 리액션(자유 텍스트 없음, 화이트리스트 CHECK) |

### DB 레벨로 보장되는 핵심 불변식

- 정산은 약속당 1회만 (`settled_at` 유무 기반 멱등)
- 자기 자신 종목에 대한 포지션 생성 차단 (`positions.investor_id <> stock_user_id`)
- 잠금 포인트 = 수량 × 개설 시점 현재가, 손실은 잠금 포인트로 클램프
- 동일 (유저, 종목, 약속) 조합에 방향 불문 포지션 1개 제한 (`uq_position_once`)
- 판정(`verdict`)-지각분(`late_minutes`)-정산가 정합 (정시=0분 / 지각=1~59분 / 노쇼=60분 고정)
- 자기주식 손절 불허 (`sold_price > acquired_price`)

---

## API 문서

> `apps/api/src/routes/*.ts` · `apps/api/src/app.ts` 전체를 코드 기준으로 정리한 실제 구현 엔드포인트 목록(총 44개).

- **Base URL:** 로컬 `http://localhost:4000/api` (모든 경로 앞에 `/api` 접두어)
- **인증 방식:** 로그인/회원가입/헬스체크/데모 정산을 제외한 전 엔드포인트는 `Authorization: Bearer <JWT>` 헤더 필수. 토큰 없음/무효 시 `401 { "error": "인증 토큰이 필요합니다." }` 또는 `401 { "error": "유효하지 않은 토큰입니다." }`
- **공통 에러 형식:** `HttpError`는 `{ "error": "메시지" }`로 직렬화됨(일부는 부가 필드가 병합됨, 예: GPS 반경 초과 시 `{ "error": "...", "distanceMeters": 73 }`). 아래 표의 "에러"는 그 외 도메인 특화 실패 조건만 표기.
- **ID 표기:** DB의 `BIGINT` PK는 JSON에서 문자열로 직렬화됨(예: `stockUserId`, `promiseId`).

### 헬스체크 / 인프라

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/health` | 서비스 자체 생존 확인(배포 도달성 검증용) | 없음 | `{ status: "ok", service, ts }` | - |
| GET | `/api/db/health` | DB 커넥션·쿼리 검증(Neon 등) | 없음 | `{ status: "ok" \| "not_configured" \| "error", ... }` | 200/503/500(상태에 따라) |
| GET | `/api/me/ping` | 인증 미들웨어 동작 확인용 데모 | 인증 필요 | `{ userId }` | 401 |

### F-16 데모 모드

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| POST | `/api/demo/settle` | 정산 스케줄러 대기 없이 즉시 정산 실행(멱등) | body: `{ now?: ISO문자열, promiseId?: number }` (둘 다 선택, 생략 시 전체 미정산 약속 대상) | `{ ok: true, settledIds, failedIds }` | 400 `now` 형식 오류 / 403 프로덕션 & `DEMO_MODE!=true` / 500 일부 약속 정산 실패 |

### F-01/F-09 인증

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| POST | `/api/auth/signup` | 회원가입 + 기본 포인트 지급 + 주식 자동 발행 | body: `{ email, password, nickname }` | 201 `{ token, user: { id, email, nickname, availablePoints, currentPrice } }` | 400 필드 누락/형식 오류 / 409 이메일 중복 |
| POST | `/api/auth/login` | 이메일·비밀번호 로그인 | body: `{ email, password }` | `{ token, user }` | 400 필드 누락 / 401 이메일 또는 비밀번호 불일치 |
| POST | `/api/auth/logout` | 로그아웃(서버 세션 없음 — 클라이언트 토큰 폐기 전제) | 인증 필요 | `{ ok: true }` | 401 |
| GET | `/api/auth/me` | 내 프로필 조회 | 인증 필요 | `{ user }` | 401 / 404 사용자 없음 |

### F-02/F-03/S-06 친구 · 랭킹

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/friends` | 내 친구(종목) 목록 — 현재가·등락 스트릭·지각위험도 포함 | 인증 필요 | `{ friends: [{ userId, nickname, currentPrice, onTimeStreak, lateRiskPct }] }` | 401 |
| GET | `/api/friends/rankings` | 친구 한정 수익률 랭킹(S-06) | 인증 필요 | `{ rankings: [{ userId, nickname, totalPayout, totalLocked, returnPct }] }` | 401 |
| GET | `/api/friends/requests` | 내가 받은 pending 친구 요청 목록 | 인증 필요 | `{ requests: [{ id, requesterId, requesterNickname, createdAt }] }` | 401 |
| POST | `/api/friends/requests` | 친구 요청 전송 | body: `{ addresseeId }` | 201 `{ id }` | 400 addresseeId 누락 / 400 자기 자신 / 404 대상 없음 / 409 이미 요청·친구 관계 |
| POST | `/api/friends/requests/:id/accept` | 요청 수락 → 상호 조회·베팅 권한 성립 | 인증 필요 | `{ ok: true }` | 404 요청 없음 / 403 내 요청함 아님 / 409 이미 처리됨 |
| POST | `/api/friends/requests/:id/reject` | 요청 거절(행 삭제) | 인증 필요 | `{ ok: true }` | 404/403/409 (accept와 동일) |
| GET | `/api/users/search?q=` | 닉네임·이메일로 유저 검색(친구 추가용) | query: `q`(필수) | `{ users: [{ id, nickname, email }] }` (최대 20건) | 400 `q` 누락 |

### F-04/F-05/F-06/F-19/S-09 약속 · GPS 인증 · 리액션

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| POST | `/api/promises` | 약속 생성(생성자=자동 수락, 초대는 친구만 가능) | body: `{ title, placeName, latitude, longitude, promisedAt(ISO), inviteUserIds[] }` | 201 `{ id }` | 400 필드 누락/좌표 범위/제목·장소 길이/시각 형식/과거 시각 / 400 친구 아닌 유저 초대 |
| GET | `/api/promises?status=` | 내 약속 목록 | query: `status?: upcoming\|ongoing\|ended` | `{ promises: [PromiseView] }` | 400 잘못된 status |
| GET | `/api/promises/:id` | 약속 상세 | 인증 필요 | `{ promise }` | 404 약속 없음(또는 내가 참여자 아님) |
| POST | `/api/promises/:id/respond` | 초대 수락/거절(F-19) | body: `{ action: "accept" \| "decline" }` | `{ ok: true }` | 400 action 값 오류 / 404 약속 없음 / 403 미초대 / 409 이미 정산·마감·응답 완료 |
| POST | `/api/promises/:id/checkin` | GPS 도착 인증(반경 50m, 종료 시각 전) | body: `{ latitude, longitude }` | `{ checkinAt }` | 400 좌표 오류/반경 밖(`distanceMeters` 포함) / 403 수락 참여자 아님 / 409 이미 정산·인증 시간 아님·재인증 |
| GET | `/api/promises/:id/participants` | 참여자 현황(공개 규칙 R-1 마스킹 적용) | 인증 필요 | `{ promisedAt, participants: [MaskedParticipantView] }` | 404 참여자 아님 |
| POST | `/api/promises/:id/reactions` | 정산 결과 이모지 리액션(화이트리스트만 허용, 재반응 시 갱신) | body: `{ emoji }` | `{ ok: true }` | 400 허용 안 된 이모지 / 403 참여자 아님 |
| GET | `/api/promises/:id/reactions` | 이모지별 집계 + 내 리액션 | 인증 필요 | `{ counts: {😱,📉,🛡️,🔥}, myReaction }` | 403 참여자 아님 |

### F-10/F-11/S-08 매수·공매도 포지션

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| POST | `/api/positions` | 매수/공매도 포지션 개설(잠금 포인트 차감) | body: `{ stockUserId, promiseId, direction: "buy"\|"short", quantity, multiplier?(레버리지 S-05) }` | 201 `{ position: PositionView }` | 400 quantity/direction/multiplier 오류 / 403 자기 주식·비친구·미수락 참여자 / 404 약속·종목 없음 / 409 정산됨·마감·중복 포지션 / 402 포인트 부족 |
| GET | `/api/positions?status=` | 내 포지션 목록(ETF leg는 제외) | query: `status?: open\|settled` | `{ positions: [PositionView] }` | 400 잘못된 status |
| POST | `/api/positions/:id/confirm` | 정산 결과 확인 처리(미확인 배너 소거) | 인증 필요 | `{ ok: true }` | 404 없음 / 403 본인 아님 / 409 미정산·이미 확인 |
| POST | `/api/positions/:id/close` | 베팅 마감 전 조기 청산(S-08) — 현재가 기준 즉시 정산 | 인증 필요 | `{ position: PositionView }` | 404 없음 / 403 본인 아님 / 409 이미 정산·취소됨 |

### F-17/F-18 자기 주식 특례

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/me/options` | 유효한 특별매수 권한 목록 | 인증 필요 | `{ options: [{ id, sourcePromiseId, quantityLimit, grantedAt, expiresAt, currentPrice }] }` | 401 |
| POST | `/api/me/options/:id/exercise` | 특별매수 행사(행사 시점 현재가 체결) | body: `{ quantity }` | 201 `{ lot: SelfStockLotView }` | 400 quantity/한도 초과 / 404 권한 없음 / 409 이미 행사 / 410 만료 / 402 포인트 부족 |
| GET | `/api/me/lots?includeSold=` | 보유 자기주식 로트 목록 | query: `includeSold?: "true"` | `{ lots: [{ id, quantity, acquiredPrice, currentPrice, canSell, unrealizedGain }] }` | 401 |
| POST | `/api/me/lots/:id/sell` | 자기주식 매도(취득가 초과 시에만, 즉시 체결) | 인증 필요 | `{ proceeds, soldPrice }` | 400 취득가 이하(손절 불허) / 404 로트 없음 / 409 이미 매도 |

### S-04 옵션 거래(콜/풋)

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| POST | `/api/options` | 옵션 매수(EWMA 프리미엄 지불, 이진 행사) | body: `{ stockUserId, promiseId, optionType: "call"\|"put", quantity }` | 201 `{ option: OptionPositionView }` | 400 quantity/optionType 오류 / 403 자기 주식·비친구·미수락 / 404 약속·종목 없음 / 409 정산됨·마감·중복 / 402 포인트 부족 |
| GET | `/api/options?status=` | 내 옵션 목록 | query: `status?: open\|settled` | `{ options: [OptionPositionView] }` | 400 잘못된 status |

### S-03 ETF 바스켓

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/etf/recommendations` | 지각 이력 기반 추천 테마(실시간 계산, 저장 안 함) | 인증 필요 | `{ recommendations: [{ themeKey, name, emoji, direction, legs }] }` | 401 |
| POST | `/api/etf/baskets` | 바스켓 개설(구성 종목별 leg = 일반 포지션, 공통 `etf_order_id` 태깅) | body: `{ direction, quantity, label?, themeKey?, legs: [{ stockUserId, promiseId }] }` | 201 `{ basket: EtfBasketView }` | 400 legs 개수/중복/형식 오류 / 403 자기 주식 포함·비친구 / 404 약속·종목 없음 / 409 정산됨·마감·중복 / 402 포인트 부족(총 잠금 기준) |
| GET | `/api/etf/baskets?status=` | 내 바스켓 목록(그룹 단위, status는 leg 전체 기준) | query: `status?: open\|settled` | `{ baskets: [EtfBasketView] }` | 401 |

### F-14 자산 현황

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/me/assets` | 가용/잠금 포인트 요약 | 인증 필요 | `{ availablePoints, lockedPoints }` | 404 사용자 없음 |
| GET | `/api/me/transactions` | 포인트 원장 내역(최신순) | 인증 필요 | `{ transactions: [{ id, amount, txType, refId, createdAt }] }` | 401 |

### F-08/F-13 주가 차트

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/me/stock` | 내 주가 차트(정산 회차별 종가) | 인증 필요 | `{ points: [{ promiseId, promisedAt, verdict, lateMinutes, settledPrice }] }` | 401 |
| GET | `/api/stocks/:userId` | 친구 주가 차트(R-5: 친구만 조회 가능) | 인증 필요 | `{ points: [ChartPoint] }` | 403 친구 아님 / 404 사용자 없음 |
| GET | `/api/stocks/:userId/promises` | 해당 종목의 베팅 가능 약속 목록 | 인증 필요 | `{ promises: [{ id, title, placeName, promisedAt }] }` | 403 자기 자신·비친구 |

### F-12/S-07 정산 도달 배너 · 알림

| Method | Endpoint | 설명 | 요청 | 응답 | 에러 |
|---|---|---|---|---|---|
| GET | `/api/me/unconfirmed-settlements` | 미확인 정산 결과(종목 본인 + 투자자 양쪽 합산) | 인증 필요 | `{ asStock: [...], asInvestor: [...], totalCount }` | 401 |
| GET | `/api/me/notifications` | 미확인 정산 + 받은 친구요청 + 받은 약속초대 통합 알림함(S-07 1차) | 인증 필요 | `{ items: [NotificationItem], totalCount }` | 401 |
| POST | `/api/me/participations/:promiseId/confirm` | 종목 본인의 정산 결과 확인 처리 | 인증 필요 | `{ ok: true }` | 404 참여 정보 없음 / 409 미정산·이미 확인 |

---

## 배포 결과물

> 접속 가능한 링크, 실행 방법, 주요 구현 내용

- **서비스 URL:**
- **실행 방법:**

```bash
# 실행 방법 작성
```

로컬 개발은 [CONTRIBUTING.md](./CONTRIBUTING.md) 참고.

---

## 회고 문서

> 개발 과정에서의 어려움, 해결 방법, 역할 분담, 다음에 개선할 점 (KPT 방법론 참고)

### Keep

### Problem

### Try

---

## 참고 자료

- [SDD(스펙 주도 개발) 이해하기](https://news.hada.io/topic?id=21338)
- [Software Design Document Best Practices](https://www.atlassian.com/work-management/project-management/design-document)
- [IA 정보구조도 작성 방법](https://brunch.co.kr/@nyonyo/7)
- [기획자 화면설계서 작성법](https://brunch.co.kr/@soup/10)
- [Figma 와이어프레임 가이드](https://www.figma.com/ko-kr/resource-library/what-is-wireframing/)
- [무료 Figma 와이어프레임 키트](https://www.figma.com/ko-kr/templates/wireframe-kits/)
- [ERD/DB 설계 총정리](https://inpa.tistory.com/entry/DB-%F0%9F%93%9A-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EB%AA%A8%EB%8D%B8%EB%A7%81-%EA%B0%9C%EB%85%90-ERD-%EB%8B%A4%EC%9D%B4%EC%96%B4%EA%B7%B8%EB%9E%A8)
- [API 명세서 작성 가이드라인](https://velog.io/@sebinChu/BackEnd-API-%EB%AA%85%EC%84%B8%EC%84%9C-%EC%9E%91%EC%84%B1-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%9D%BC%EC%9D%B8)
- [좋은 README 작성하는 방법](https://velog.io/@sabo/good-readme)
- [단기 프로젝트 회고 KPT 방법론](https://velog.io/@habwa/%EB%8B%A8%EA%B8%B0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%ED%9A%8C%EA%B3%A0-KPT-%EB%B0%A9%EB%B2%95%EB%A1%A0)
