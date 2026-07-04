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
CREATE TYPE position_status AS ENUM ('open', 'settled', 'cancelled');               -- cancelled = S-08(2차)
CREATE TYPE tx_type         AS ENUM ('signup_grant',       -- F-09 가입 지급
                                     'position_lock',      -- F-10/F-11 잠금(음수)
                                     'position_unlock',    -- F-12 잠금 반환(양수)
                                     'position_payout',    -- F-12 손익(±)
                                     'defense_reward',     -- F-15 방어 보상(양수)
                                     'self_stock_buy',     -- F-17 행사(음수)
                                     'self_stock_sell');   -- F-18 매도(양수)

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
    CHECK (locked_points = quantity * open_price),           -- D3 잠금 공식 위반 데이터 차단
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

COMMIT;
