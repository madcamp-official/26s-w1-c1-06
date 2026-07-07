-- 규칙 위반 시나리오가 DB 제약에 의해 거부되는지 검증.
-- \echo 로 각 케이스 표시. 실패해야 하는 문장은 개별 트랜잭션 + ROLLBACK 패턴.

\set ON_ERROR_STOP off
\pset pager off

\echo '===== [정상 흐름] 가입 2명 + 원장 + 친구 + 약속 + 참여 + 포지션 ====='
BEGIN;
INSERT INTO users (email, nickname, available_points) VALUES ('a@t.com','철수',100000), ('b@t.com','영희',100000);
INSERT INTO point_transactions (user_id, amount, tx_type) VALUES (1,100000,'signup_grant'),(2,100000,'signup_grant');
INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES (1,2,'accepted',now());
INSERT INTO promises (creator_id,title,place_name,latitude,longitude,promised_at,settle_due_at)
  VALUES (1,'점심','강남역',37.49,127.02, now()+interval '1 hour', now()+interval '2 hour');
INSERT INTO promise_participants (promise_id,user_id,invite_status,responded_at) VALUES (1,1,'accepted',now()),(1,2,'invited',NULL);
UPDATE promise_participants SET invite_status='accepted', responded_at=now() WHERE promise_id=1 AND user_id=2;
-- 철수가 영희(약속1)의 지각에 3주 공매도 @10,000
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points) VALUES (1,2,1,'short',3,10000,30000);
INSERT INTO point_transactions (user_id,amount,tx_type,ref_id) VALUES (1,-30000,'position_lock',1);
UPDATE users SET available_points = available_points - 30000 WHERE id=1;
COMMIT;
SELECT 'OK: 정상 흐름 커밋' AS result;

\echo '===== [위반 1] 역방향 친구 요청 중복 (2→1) → UNIQUE 거부돼야 함 ====='
INSERT INTO friendships (requester_id, addressee_id) VALUES (2,1);

\echo '===== [위반 2] 자기 자신 친구 요청 → CHECK 거부 ====='
INSERT INTO friendships (requester_id, addressee_id) VALUES (1,1);

\echo '===== [위반 3] 자기 주식 포지션 (P-5) → CHECK 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points) VALUES (2,2,1,'buy',1,10000,10000);

\echo '===== [위반 4] 동일 (투자자,종목,약속) 중복 포지션 (D6) → UNIQUE 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points) VALUES (1,2,1,'buy',1,10000,10000);

\echo '===== [위반 5] 잠금 ≠ 수량×개설가 (D3) → CHECK 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points) VALUES (2,1,1,'buy',2,10000,999);

\echo '===== [위반 6] 지각 판정인데 late_minutes=0 (F-06 정합) → CHECK 거부 ====='
UPDATE promise_participants SET verdict='late', late_minutes=0, settled_price=9000 WHERE promise_id=1 AND user_id=2;

\echo '===== [위반 7] 노쇼인데 checkin_at 존재 → CHECK 거부 ====='
UPDATE promise_participants SET checkin_at=now(), verdict='no_show', late_minutes=60, settled_price=4000 WHERE promise_id=1 AND user_id=2;

\echo '===== [정상 흐름] 정산: 영희 32분 지각, 10000→6800 ====='
BEGIN;
UPDATE promise_participants SET checkin_at=now(), verdict='late', late_minutes=32, settled_price=6800 WHERE promise_id=1 AND user_id=2;
UPDATE users SET current_price=6800, ewma_late_p = 0.25*1 + 0.75*ewma_late_p WHERE id=2;
UPDATE positions SET status='settled', price_before=10000, price_after=6800, payout=3*(10000-6800), settled_at=now() WHERE id=1;
INSERT INTO point_transactions (user_id,amount,tx_type,ref_id) VALUES (1,30000,'position_unlock',1),(1,9600,'position_payout',1);
UPDATE users SET available_points = available_points + 30000 + 9600 WHERE id=1;
UPDATE promises SET settled_at=now() WHERE id=1;
COMMIT;
SELECT 'OK: 정산 커밋(공매도 수익 +9,600)' AS result;

\echo '===== [위반 8] 손실 > 잠금 (클램프 위반) → CHECK 거부 ====='
BEGIN;
INSERT INTO promises (creator_id,title,place_name,latitude,longitude,promised_at,settle_due_at)
  VALUES (2,'저녁','홍대',37.55,126.92, now()+interval '3 hour', now()+interval '4 hour');
INSERT INTO promise_participants (promise_id,user_id,invite_status,responded_at) VALUES (2,1,'accepted',now());
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points) VALUES (2,1,2,'short',2,10000,20000);
COMMIT;
UPDATE positions SET status='settled', price_before=10000, price_after=25000, payout=-20001, settled_at=now() WHERE investor_id=2 AND stock_user_id=1 AND promise_id=(SELECT id FROM promises WHERE title='저녁');
SELECT 'INFO: 클램프 상한값(-20000)은 통과해야 함' AS note;
UPDATE positions SET status='settled', price_before=10000, price_after=25000, payout=-20000, settled_at=now() WHERE investor_id=2 AND stock_user_id=1 AND promise_id=(SELECT id FROM promises WHERE title='저녁');
SELECT status, payout FROM positions WHERE investor_id=2 AND stock_user_id=1;

\echo '===== [위반 9] settled인데 payout 없음 (상태 정합) → CHECK 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points,status) VALUES (2,1,2,'buy',1,10000,10000,'settled');

\echo '===== [정상] F-17 권한 발급 + 행사 → 로트 생성 ====='
BEGIN;
INSERT INTO self_stock_options (user_id, source_promise_id, quantity_limit, expires_at) SELECT 1, id, 3, now()+interval '24 hour' FROM promises WHERE title='저녁';
INSERT INTO self_stock_lots (user_id, option_id, quantity, acquired_price) SELECT 1, id, 3, 6800 FROM self_stock_options WHERE user_id=1;
UPDATE self_stock_options SET exercised_at=now() WHERE user_id=1;
INSERT INTO point_transactions (user_id,amount,tx_type) VALUES (1,-20400,'self_stock_buy');
UPDATE users SET available_points = available_points - 20400 WHERE id=1;
COMMIT;
SELECT 'OK: F-17 행사(3주 @6,800)' AS result;

\echo '===== [위반 10] 같은 약속으로 권한 중복 발급 (멱등) → UNIQUE 거부 ====='
INSERT INTO self_stock_options (user_id, source_promise_id, quantity_limit, expires_at) SELECT 1, id, 3, now()+interval '24 hour' FROM promises WHERE title='저녁';

\echo '===== [위반 11] 권한 1개로 로트 2개 (이중 행사) → UNIQUE 거부 ====='
INSERT INTO self_stock_lots (user_id, option_id, quantity, acquired_price) SELECT 1, id, 1, 6800 FROM self_stock_options WHERE user_id=1;

\echo '===== [위반 12] 손절 매도 (취득가 이하, F-18) → CHECK 거부 ====='
UPDATE self_stock_lots SET sold_price=6800, sold_at=now() WHERE user_id=1;

\echo '===== [위반 13] 가용 포인트 음수 → CHECK 거부 ====='
UPDATE users SET available_points = -1 WHERE id=1;

\echo '===== [ETF 정상 흐름] 바스켓 헤더 + leg 3개 — positions를 그대로 재사용 (S-03) ====='
BEGIN;
INSERT INTO users (email, nickname, available_points) VALUES ('c@t.com','민수',100000), ('d@t.com','지훈',100000);
INSERT INTO point_transactions (user_id, amount, tx_type) VALUES (3,100000,'signup_grant'),(4,100000,'signup_grant');
INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES (1,3,'accepted',now()),(1,4,'accepted',now());
-- 약속 3=스터디(민수), 4=축구(지훈), 5=저녁2(영희 — 기존 약속1은 이미 정산되어 재사용 불가)
INSERT INTO promises (creator_id,title,place_name,latitude,longitude,promised_at,settle_due_at) VALUES
  (1,'스터디','강남역',37.49,127.02, now()+interval '1 hour', now()+interval '2 hour'),
  (1,'축구','잠실',37.51,127.10, now()+interval '1 hour', now()+interval '2 hour'),
  (1,'저녁2','강남역',37.49,127.02, now()+interval '1 hour', now()+interval '2 hour');
INSERT INTO promise_participants (promise_id,user_id,invite_status,responded_at) VALUES
  (3,1,'accepted',now()),(3,3,'accepted',now()),
  (4,1,'accepted',now()),(4,4,'accepted',now()),
  (5,1,'accepted',now()),(5,2,'accepted',now());

INSERT INTO etf_orders (investor_id, label, theme_key, direction) VALUES (1,'시한폭탄 트리오','risky-3-mid','short');
-- 철수가 영희(약속5)·민수(약속3)·지훈(약속4)을 한 바스켓으로 공매도 3주(각 2주)
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points,etf_order_id) VALUES
  (1,2,5,'short',2,6800, 13600, (SELECT id FROM etf_orders WHERE label='시한폭탄 트리오')),
  (1,3,3,'short',2,10000,20000, (SELECT id FROM etf_orders WHERE label='시한폭탄 트리오')),
  (1,4,4,'short',2,10000,20000, (SELECT id FROM etf_orders WHERE label='시한폭탄 트리오'));
INSERT INTO point_transactions (user_id, amount, tx_type, ref_id)
  SELECT 1, -locked_points, 'position_lock', id FROM positions WHERE etf_order_id IS NOT NULL;
UPDATE users SET available_points = available_points - 53600 WHERE id=1; -- 13600+20000+20000
COMMIT;
SELECT 'OK: ETF 바스켓 개설(3-leg, 잠금 53,600)' AS result;

\echo '===== [검증] 바스켓별 leg 조회 (idx_pos_etf, 자산/자산-바스켓 화면 재현) ====='
SELECT eo.label, u.nickname AS stock_nickname, p.locked_points, p.status
FROM positions p
JOIN etf_orders eo ON eo.id = p.etf_order_id
JOIN users u ON u.id = p.stock_user_id
ORDER BY eo.id, p.stock_user_id;

\echo '===== [위반 14] ETF leg도 자기주식 금지(P-5)가 그대로 적용 → CHECK 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points,etf_order_id)
  VALUES (1,1,3,'short',1,10000,10000,(SELECT id FROM etf_orders WHERE label='시한폭탄 트리오'));

\echo '===== [위반 15] ETF leg도 동일(투자자,종목,약속) 중복 금지(D6)가 그대로 적용 → UNIQUE 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points,etf_order_id)
  VALUES (1,3,3,'buy',1,10000,10000,(SELECT id FROM etf_orders WHERE label='시한폭탄 트리오'));

\echo '===== [위반 16] 존재하지 않는 etf_order_id 참조 → FK 거부 ====='
INSERT INTO positions (investor_id,stock_user_id,promise_id,direction,quantity,open_price,locked_points,etf_order_id)
  VALUES (1,3,4,'short',1,10000,10000,999999);

\echo '===== [ETF 정산] 영희(약속5) leg만 개별 정산 — 나머지 2건은 open으로 남는다(부분 정산) ====='
BEGIN;
UPDATE promise_participants SET checkin_at=now(), verdict='late', late_minutes=25, settled_price=5100 WHERE promise_id=5 AND user_id=2;
UPDATE users SET current_price=5100 WHERE id=2;
UPDATE positions SET status='settled', price_before=6800, price_after=5100, payout=2*(6800-5100), settled_at=now()
  WHERE investor_id=1 AND stock_user_id=2 AND promise_id=5;
INSERT INTO point_transactions (user_id,amount,tx_type,ref_id)
  SELECT 1, locked_points, 'position_unlock', id FROM positions WHERE investor_id=1 AND stock_user_id=2 AND promise_id=5
  UNION ALL
  SELECT 1, payout, 'position_payout', id FROM positions WHERE investor_id=1 AND stock_user_id=2 AND promise_id=5;
UPDATE users SET available_points = available_points + 13600 + 3400 WHERE id=1;
UPDATE promises SET settled_at=now() WHERE id=5;
COMMIT;
SELECT 'OK: ETF 바스켓 부분 정산(영희 leg만 +3,400, 민수·지훈 leg는 여전히 open)' AS result;

SELECT eo.label,
       count(*) FILTER (WHERE p.status = 'open')    AS legs_open,
       count(*) FILTER (WHERE p.status = 'settled') AS legs_settled,
       COALESCE(sum(p.payout) FILTER (WHERE p.status = 'settled'), 0) AS realized_payout
FROM positions p JOIN etf_orders eo ON eo.id = p.etf_order_id
WHERE eo.label = '시한폭탄 트리오'
GROUP BY eo.label;

\echo '===== [검증] 원장 합계 = 잔액 불변식 ====='
SELECT u.id, u.nickname, u.available_points AS balance, COALESCE(SUM(t.amount),0) AS ledger_sum,
       (u.available_points = COALESCE(SUM(t.amount),0)) AS invariant_ok
FROM users u LEFT JOIN point_transactions t ON t.user_id = u.id
GROUP BY u.id ORDER BY u.id;

\echo '===== [검증] 정산 폴링 쿼리가 부분 인덱스를 사용하는가 ====='
SET enable_seqscan = off;
EXPLAIN (COSTS OFF) SELECT id FROM promises WHERE settled_at IS NULL AND settle_due_at <= now();
SET enable_seqscan = on;

\echo '===== [검증] 차트 쿼리 (price_history 없이 participants로 재현) ====='
SELECT p.settle_due_at::date AS day, pp.settled_price, pp.verdict
FROM promise_participants pp JOIN promises p ON p.id = pp.promise_id
WHERE pp.user_id = 2 AND pp.settled_price IS NOT NULL ORDER BY p.settle_due_at;
