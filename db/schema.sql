-- ============================================================
-- 지각비 주식 시장 · DB 스키마 v1  (기능 명세서 v7 기준)
-- PostgreSQL 16 / 모든 시각 TIMESTAMPTZ / 포인트·가격 INT(원 단위)
-- 원칙: 게임 규칙 중 "절대 어겨선 안 되는 것"은 CHECK/UNIQUE로 DB 레벨 보장
-- ============================================================

BEGIN;

-- ---------- ENUM ----------
CREATE TYPE friend_status   AS ENUM ('pending', 'accepted');                        -- 거절 = 행 삭제(재요청 허용)
CREATE TYPE invite_status   AS ENUM ('invited', 'accepted', 'declined', 'auto_declined'); -- F-19
CREATE TYPE verdict_type    AS ENUM ('on_time', 'late', 'no_show');                 -- F-06
CREATE TYPE position_dir    AS ENUM ('buy', 'short');                               -- F-10/F-11
CREATE TYPE position_status AS ENUM ('open', 'settled', 'cancelled');               -- cancelled = S-08(2차), option_positions도 재사용
CREATE TYPE option_type     AS ENUM ('call', 'put');                                -- S-04
CREATE TYPE tx_type         AS ENUM ('signup_grant',       -- F-09 가입 지급
                                     'position_lock',      -- F-10/F-11 잠금(음수)
                                     'position_unlock',    -- F-12 잠금 반환(양수)
                                     'position_payout',    -- F-12 손익(±)
                                     'defense_reward',     -- F-15 방어 보상(양수)
                                     'self_stock_buy',     -- F-17 행사(음수)
                                     'self_stock_sell',    -- F-18 매도(양수)
                                     'option_premium',     -- S-04 프리미엄 지불(음수)
                                     'option_payout',      -- S-04 행사 배당(양수, 실패 시 미기록)
                                     'shop_purchase');     -- 칭호·배지 상점 구매(음수)
CREATE TYPE shop_item_type   AS ENUM ('title', 'badge');                            -- 상점 항목 종류

-- ---------- users : 계정 + 종목(1:1 병합) + 지갑 ----------
-- 주식은 가입 시 유저당 1개·전역 단일 가격(v7 R-3)이므로 별도 stock 테이블 없이 병합.
CREATE TABLE users (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255),                          -- 소셜 로그인 시 NULL
    provider          VARCHAR(20)  NOT NULL DEFAULT 'email', -- 'email' | 'kakao'
    provider_id       VARCHAR(100),                          -- 소셜 고유 ID
    nickname          VARCHAR(30)  NOT NULL,
    available_points  INT NOT NULL DEFAULT 0 CHECK (available_points >= 0),  -- 가용(잠금 제외). 원장 합계와 일치해야 함
    current_price     INT NOT NULL DEFAULT 10000 CHECK (current_price > 0),  -- F-07 종목 현재가(최근 정산가), 0원 방지
    ewma_late_p       REAL NOT NULL DEFAULT 0.5 CHECK (ewma_late_p BETWEEN 0 AND 1), -- L-01 (α=0.25, p0=0.5). 정산 배치가 갱신
    on_time_streak    INT  NOT NULL DEFAULT 0 CHECK (on_time_streak >= 0),   -- [2차 S-01/I-4] 연속 정시 카운트
    auto_accept_invites BOOLEAN NOT NULL DEFAULT false,        -- 데모/시드용 가상 계정 전용. 실제 유저는 항상 false(F-19 수동 응답 유지)
    equipped_title_key  VARCHAR(50),                           -- 상점에서 구매한 칭호 중 장착한 것(shop.ts SHOP_TITLES 키). NULL=미장착
    equipped_badge_key  VARCHAR(50),                           -- 상점에서 구매한 배지 중 장착한 것(shop.ts SHOP_BADGES 키). NULL=미장착
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (provider = 'email' OR provider_id IS NOT NULL)    -- 소셜 계정은 provider_id 필수
);
CREATE UNIQUE INDEX uq_users_provider ON users (provider, provider_id) WHERE provider_id IS NOT NULL;

-- ---------- friendships : 친구 요청/수락 = 조회·베팅 권한 (F-02) ----------
CREATE TABLE friendships (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester_id  BIGINT NOT NULL REFERENCES users(id),
    addressee_id  BIGINT NOT NULL REFERENCES users(id),
    status        friend_status NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at  TIMESTAMPTZ,
    CHECK (requester_id <> addressee_id)                     -- 자기 자신에게 요청 불가
);
-- 방향 무관 쌍당 1행(역방향 중복 요청 차단)
CREATE UNIQUE INDEX uq_friend_pair ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX idx_friend_addressee ON friendships (addressee_id, status);  -- 받은 요청함(SC-06)

-- ---------- promises : 약속 (F-04) ----------
CREATE TABLE promises (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    creator_id     BIGINT NOT NULL REFERENCES users(id),
    title          VARCHAR(100) NOT NULL,
    place_name     VARCHAR(100) NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
    longitude      DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    promised_at    TIMESTAMPTZ NOT NULL,                     -- 약속 시각 = 베팅 마감(D4)
    settle_due_at  TIMESTAMPTZ NOT NULL,                     -- 종료 시각 = promised_at + 60분(노쇼 상한). 생성 시 계산 저장
    settled_at     TIMESTAMPTZ,                              -- NULL = 미정산 (정산 멱등 키)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (settle_due_at > promised_at)
);
-- 정산 폴링 전용: 미정산 약속만 담는 부분 인덱스 → 폴링 비용이 미정산 건수에만 비례 (F-12)
CREATE INDEX idx_promises_unsettled ON promises (settle_due_at) WHERE settled_at IS NULL;

-- ---------- promise_participants : 참여·판정·가격 히스토리 (F-05/F-06/F-08/F-19) ----------
-- 모델 B에서 가격은 오직 약속 판정으로만 변하므로, 별도 price_history 테이블 없이
-- "참여 판정 + 그 결과 정산가(settled_price)"를 한 행으로 기록한다(이중 기록 제거).
CREATE TABLE promise_participants (
    promise_id     BIGINT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    user_id        BIGINT NOT NULL REFERENCES users(id),
    invite_status  invite_status NOT NULL DEFAULT 'invited', -- 생성자는 'accepted'로 삽입
    responded_at   TIMESTAMPTZ,
    checkin_at     TIMESTAMPTZ,                              -- GPS 인증 시각. NULL 조건 UPDATE로 재인증 차단(F-05 AC)
    verdict        verdict_type,                             -- 정산 배치에서 확정(F-06)
    late_minutes   SMALLINT,
    settled_price  INT CHECK (settled_price IS NULL OR settled_price > 0), -- 이 판정 반영 후 종목 정산가 = 차트 데이터(F-08/F-13)
    result_confirmed_at TIMESTAMPTZ,                         -- 종목 본인의 "미확인 정산" 배너 소거 시각(F-12)
    PRIMARY KEY (promise_id, user_id),
    -- 판정-지각분 정합을 DB가 보장 (F-06: 정시=0, 지각=1~59, 노쇼=60 고정)
    CHECK (
        (verdict IS NULL     AND late_minutes IS NULL AND settled_price IS NULL) OR
        (verdict = 'on_time' AND late_minutes = 0) OR
        (verdict = 'late'    AND late_minutes BETWEEN 1 AND 59) OR
        (verdict = 'no_show' AND late_minutes = 60 AND checkin_at IS NULL)
    )
);
CREATE INDEX idx_pp_user ON promise_participants (user_id, invite_status);                 -- 내 약속 목록(SC-07)
CREATE INDEX idx_pp_unconfirmed ON promise_participants (user_id)                          -- 종목 본인 미확인 배너 카운트
    WHERE verdict IS NOT NULL AND result_confirmed_at IS NULL;

-- ---------- positions : 약속 단위 베팅 포지션 (F-10/F-11/F-12) ----------
CREATE TABLE positions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    investor_id    BIGINT NOT NULL REFERENCES users(id),     -- 베팅한 사람
    stock_user_id  BIGINT NOT NULL REFERENCES users(id),     -- 종목(친구)
    promise_id     BIGINT NOT NULL REFERENCES promises(id),  -- 반드시 특정 약속에 연결(D1)
    direction      position_dir NOT NULL,
    quantity       INT NOT NULL CHECK (quantity > 0),
    open_price     INT NOT NULL CHECK (open_price > 0),      -- 개설 시점 현재가(잠금 산정 기준, D3)
    locked_points  INT NOT NULL,
    multiplier     SMALLINT NOT NULL DEFAULT 1 CHECK (multiplier >= 1),  -- [2차 S-05] 1 = 일반
    price_before   INT,                                      -- 정산 직전가(손익 근거 기록)
    price_after    INT,                                      -- 정산 후가
    payout         INT,                                      -- 실현 손익(±)
    status         position_status NOT NULL DEFAULT 'open',
    confirmed_at   TIMESTAMPTZ,                              -- 투자자의 "미확인 정산" 배너 소거 시각(F-12)
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at     TIMESTAMPTZ,
    CHECK (investor_id <> stock_user_id),                    -- P-5: 자기 주식 포지션 원천 차단(DB 레벨)
    CHECK (locked_points = quantity * open_price),           -- D3 잠금 공식 위반 데이터 차단(잠금=마진은 배율과 무관 고정, S-05는 손익에만 배수 적용)
    CHECK (payout IS NULL OR payout >= -locked_points),      -- D3 손실 클램프: 잠금 초과 손실 데이터 차단
    -- 상태 정합: settled면 정산 필드 필수, 아니면 전부 NULL
    CHECK (
        (status = 'settled' AND payout IS NOT NULL AND price_before IS NOT NULL AND price_after IS NOT NULL AND settled_at IS NOT NULL) OR
        (status <> 'settled' AND payout IS NULL AND price_before IS NULL AND price_after IS NULL AND settled_at IS NULL)
    )
);
CREATE UNIQUE INDEX uq_position_once ON positions (investor_id, stock_user_id, promise_id); -- D6: 1포지션(방향 불문)
CREATE INDEX idx_pos_settle  ON positions (promise_id) WHERE status = 'open';                -- 정산 배치가 약속별 일괄 조회
CREATE INDEX idx_pos_my      ON positions (investor_id, status);                             -- 자산 화면(SC-15)
CREATE INDEX idx_pos_unconfirmed ON positions (investor_id)                                  -- 투자자 미확인 배너 카운트
    WHERE status = 'settled' AND confirmed_at IS NULL;

-- ---------- etf_orders : ETF 바스켓 헤더 (S-03) ----------
-- 바스켓의 실제 베팅 내용은 별도로 저장하지 않는다 — 아래 positions.etf_order_id로
-- 태깅된 평범한 positions 행(leg)들이 곧 베팅 내용이다. 이 테이블은 표시용 헤더(이름·테마)만 담당.
-- 정산은 각 leg가 걸린 약속이 정산될 때 기존 정산 엔진(T2)이 그대로 처리 — 바스켓 전용 정산 로직 없음.
CREATE TABLE etf_orders (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    investor_id  BIGINT NOT NULL REFERENCES users(id),
    label        VARCHAR(40) NOT NULL,   -- "노답 3형제"(추천) 또는 사용자 지정 이름(직접 만들기)
    theme_key    VARCHAR(40),            -- 추천 테마에서 만들어졌으면 규칙 key, 직접 만들기는 NULL
    direction    position_dir NOT NULL,  -- 바스켓 전체 단일 방향(D1 준용). positions.direction과 항상 동일(조회 편의 목적 중복 저장)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_etf_orders_investor ON etf_orders (investor_id, created_at DESC); -- 자산 화면 바스켓 목록(SC-15/17)

-- positions는 etf_orders보다 먼저 정의되어 있어 CREATE TABLE 안에서 바로 참조할 수 없으므로 ALTER로 추가.
-- NULL = 바스켓에 속하지 않은 일반 포지션(F-10/F-11). 이 컬럼 하나로 바스켓의 leg를 그룹핑하며,
-- 정산 로직(T2)은 이 컬럼의 존재를 전혀 모른 채 지금과 동일하게 동작한다(설계상 핵심).
ALTER TABLE positions ADD COLUMN etf_order_id BIGINT REFERENCES etf_orders(id);
CREATE INDEX idx_pos_etf ON positions (etf_order_id) WHERE etf_order_id IS NOT NULL; -- 바스켓별 leg 조회

-- ---------- option_positions : 옵션 거래(콜/풋) 포지션 (S-04) ----------
-- strike 없는 이진 행사: 콜=정시, 풋=지각/노쇼. 프리미엄은 구매 시점 EWMA(p_at_purchase)로 고정.
CREATE TABLE option_positions (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    investor_id       BIGINT NOT NULL REFERENCES users(id),
    stock_user_id     BIGINT NOT NULL REFERENCES users(id),
    promise_id        BIGINT NOT NULL REFERENCES promises(id),
    option_type       option_type NOT NULL,
    quantity          INT NOT NULL CHECK (quantity > 0),
    reference_price   INT NOT NULL CHECK (reference_price > 0),  -- 구매 시점 현재가(배당 산정 기준)
    premium_paid      INT NOT NULL CHECK (premium_paid >= 0),    -- 즉시 지불(환불 없음)
    p_at_purchase     REAL NOT NULL CHECK (p_at_purchase BETWEEN 0 AND 1), -- L-01 EWMA, 프리미엄 산정 근거 기록
    payout            INT,                                       -- 배당(실패 시 0, point_transactions 미기록)
    status            position_status NOT NULL DEFAULT 'open',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at        TIMESTAMPTZ,
    UNIQUE (investor_id, stock_user_id, promise_id, option_type)  -- 동일 약속·종목·유형 중복 매수 차단
);
CREATE INDEX idx_option_positions_investor ON option_positions (investor_id);
CREATE INDEX idx_option_positions_settle ON option_positions (promise_id, stock_user_id, status); -- 정산 배치 조회(settleOptionsForStock)

-- ---------- self_stock_options : F-17 특별매수 권한 ----------
CREATE TABLE self_stock_options (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id),
    source_promise_id  BIGINT NOT NULL REFERENCES promises(id), -- 어느 약속의 정시로 발급됐나
    quantity_limit     SMALLINT NOT NULL CHECK (quantity_limit > 0),  -- 2~3주(앱 상수)
    granted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL,                 -- granted_at + 24h. 만료는 조회 시 판정(상태 배치 불필요)
    exercised_at       TIMESTAMPTZ,                          -- NULL = 미행사. 1회성
    CHECK (expires_at > granted_at),
    UNIQUE (user_id, source_promise_id)                      -- 정산 재실행에도 권한 중복 발급 차단(멱등 보조)
);
CREATE INDEX idx_option_active ON self_stock_options (user_id) WHERE exercised_at IS NULL;   -- SC-14 유효 권한 조회

-- ---------- self_stock_lots : F-18 보유 자기주식(취득 단위) ----------
CREATE TABLE self_stock_lots (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    option_id       BIGINT NOT NULL UNIQUE REFERENCES self_stock_options(id), -- 권한 1회 행사 = 로트 1개
    quantity        SMALLINT NOT NULL CHECK (quantity > 0),
    acquired_price  INT NOT NULL CHECK (acquired_price > 0), -- 행사 시점 현재가(v7 R-2)
    acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    sold_price      INT,
    sold_at         TIMESTAMPTZ,
    CHECK ((sold_at IS NULL) = (sold_price IS NULL)),
    CHECK (sold_price IS NULL OR sold_price > acquired_price) -- F-18 손절 불허를 DB가 보장
);
CREATE INDEX idx_lot_holding ON self_stock_lots (user_id) WHERE sold_at IS NULL;             -- 보유분 조회(SC-14)

-- ---------- point_transactions : 포인트 원장 (F-09/F-14/F-15 내역 + 정합성 검증) ----------
-- 불변식: users.available_points = SUM(amount) (유저별). 모든 포인트 변동은 반드시 이 원장과 함께 기록.
CREATE TABLE point_transactions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    amount      INT NOT NULL CHECK (amount <> 0),            -- 양수=입금, 음수=출금(잠금 포함)
    tx_type     tx_type NOT NULL,
    ref_id      BIGINT,                                      -- 참조: lock/unlock/payout→positions.id, defense_reward→promise.id, self_buy/sell→lots.id
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON point_transactions (user_id, created_at DESC);                  -- 내역 화면(SC-15/16)

-- ---------- reactions : 정산 결과 이모지 리액션 (S-09) ----------
-- 자유 텍스트 없음(P-4 가드레일) — 화이트리스트를 CHECK로 DB 레벨 보장.
CREATE TABLE reactions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    promise_id  BIGINT NOT NULL REFERENCES promises(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    emoji       VARCHAR(8) NOT NULL CHECK (emoji IN ('😱','📉','🛡️','🔥')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (promise_id, user_id)                                -- 1인 1약속 1이모지(재반응은 갱신)
);
CREATE INDEX idx_reactions_promise ON reactions (promise_id);

-- ---------- shop_purchases : 칭호·배지 상점 구매 내역(=보유 목록) ----------
-- 카탈로그(가격·등급)는 DB가 아니라 @latestock/shared SHOP_TITLES/SHOP_BADGES 상수가 원본.
-- item_key로 그 상수 배열의 항목을 참조. 장착 상태는 users.equipped_title_key/equipped_badge_key.
CREATE TABLE shop_purchases (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    item_key     VARCHAR(50) NOT NULL,
    item_type    shop_item_type NOT NULL,
    price_paid   INT NOT NULL CHECK (price_paid > 0),
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, item_key)                                  -- 같은 항목 중복 구매 방지
);
CREATE INDEX idx_shop_purchases_user ON shop_purchases (user_id);

COMMIT;
