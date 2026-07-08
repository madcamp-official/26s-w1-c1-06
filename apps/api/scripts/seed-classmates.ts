/**
 * 분반 멤버 실명으로 더미 친구 + 차트 이력 생성.
 *
 * - 대상(target) 계정이 이미 만들어둔 "Test1" 약속의 장소(place_name/lat/lng)를 그대로 재사용한다.
 * - 멤버를 정시파/지각파/들쭉날쭉 세 그룹으로 나눠 각자 다른 체크인 패턴의 과거 약속 8개씩을 만들고,
 *   실제 정산 엔진(runSettlementNow)으로 정산해 차트에 바로 그래프가 뜨게 한다.
 * - 계정은 전부 auto_accept_invites=true 가상 계정(test.local 이메일)이라 실제 멤버가 로그인할 필요 없다.
 *
 * 사용: npx tsx scripts/seed-classmates.ts --target "허서준1"
 *
 * 전제: target 계정으로 "Test1"이라는 제목의 약속을 실제 사이트에서 이미 하나 만들어뒀어야 한다
 *      (그 약속의 장소 좌표를 그대로 복사해서 씀).
 */
import "../src/load-env.js";
import { INITIAL_POINTS, NO_SHOW_MINUTES } from "@latestock/shared";
import bcrypt from "bcryptjs";
import pg from "pg";
import { runSettlementNow } from "../src/settlement/scheduler.js";

const TARGET_NICKNAME = process.argv.includes("--target")
  ? (process.argv[process.argv.indexOf("--target") + 1] ?? "허서준1")
  : "허서준1";

type Profile = "punctual" | "late" | "mixed";

const MEMBERS: { nickname: string; profile: Profile }[] = [
  { nickname: "권순호", profile: "punctual" },
  { nickname: "김태현", profile: "punctual" },
  { nickname: "김희서", profile: "punctual" },
  { nickname: "라태형", profile: "punctual" },
  { nickname: "박준서", profile: "punctual" },
  { nickname: "안종화", profile: "late" },
  { nickname: "유나연", profile: "late" },
  { nickname: "유영석", profile: "late" },
  { nickname: "이서진", profile: "late" },
  { nickname: "이예원", profile: "late" },
  { nickname: "이유담", profile: "mixed" },
  { nickname: "이종혁", profile: "mixed" },
  { nickname: "이지민", profile: "mixed" },
  { nickname: "정서영", profile: "mixed" },
  { nickname: "주성민", profile: "mixed" },
];

/** null = 노쇼(체크인 없음), 숫자 = 그만큼 지각(0 = 정시). 배열 앞쪽이 더 과거 시점. */
const PROFILE_SCENARIOS: Record<Profile, (number | null)[][]> = {
  punctual: [
    [0, 0, 5, 0, 0, 10, 0, 0],
    [0, 5, 0, 0, 0, 8, 0, 3],
    [5, 0, 0, 10, 0, 0, 0, 0],
    [0, 0, 0, 5, 0, 0, 12, 0],
    [0, 8, 0, 0, 5, 0, 0, 0],
  ],
  late: [
    [45, null, 30, 50, null, 40, 55, 35],
    [null, 40, 50, 35, null, 45, 30, null],
    [50, 35, null, 45, 40, null, 55, 30],
    [40, null, 45, 30, 50, 35, null, 40],
    [null, 50, 35, 40, null, 45, 30, 55],
  ],
  mixed: [
    [0, 45, 10, null, 0, 30, 5, 50],
    [5, 0, null, 20, 0, 40, 0, 10],
    [0, 30, 0, null, 15, 0, 45, 0],
    [10, 0, 40, 0, null, 5, 0, 25],
    [0, null, 5, 30, 0, 15, 0, null],
  ],
};

const HOURS_BETWEEN = 6;
const DEFAULT_PASSWORD = "password12";

interface UserRow {
  id: string;
  nickname: string;
}

async function findUserByNickname(client: pg.PoolClient, nickname: string): Promise<UserRow | null> {
  const r = await client.query<UserRow>(
    `SELECT id::text, nickname FROM users WHERE nickname = $1 LIMIT 1`,
    [nickname],
  );
  return r.rows[0] ?? null;
}

async function ensureVirtualUser(client: pg.PoolClient, nickname: string): Promise<string> {
  // 로그인 시 이메일을 toLowerCase()로 정규화해 조회한다(auth.ts) — encodeURIComponent가
  // 대문자 hex(%EC%9D%B4 등)를 만들기 때문에 여기서도 미리 소문자로 맞춰야 로그인이 된다.
  const email = `classmate.${encodeURIComponent(nickname)}@test.local`.toLowerCase();
  const existing = await client.query<{ id: string }>(`SELECT id::text FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0].id;

  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, nickname, available_points, current_price, auto_accept_invites)
     VALUES ($1, $2, $3, 0, 10000, true)
     RETURNING id::text`,
    [email, hash, nickname],
  );
  const userId = inserted.rows[0]!.id;

  await client.query(
    `INSERT INTO point_transactions (user_id, amount, tx_type) VALUES ($1, $2, 'signup_grant')`,
    [userId, INITIAL_POINTS],
  );
  await client.query(`UPDATE users SET available_points = $2 WHERE id = $1`, [userId, INITIAL_POINTS]);
  return userId;
}

async function ensureFriendship(client: pg.PoolClient, targetId: string, friendId: string): Promise<void> {
  const existing = await client.query(
    `SELECT 1 FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [targetId, friendId],
  );
  if ((existing.rowCount ?? 0) > 0) return;
  await client.query(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
     VALUES ($1, $2, 'accepted', now())`,
    [friendId, targetId],
  );
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL 없음");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("neon.tech") || url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();
  try {
    const target = await findUserByNickname(client, TARGET_NICKNAME);
    if (!target) {
      console.error(`'${TARGET_NICKNAME}' 닉네임 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }
    console.log(`대상: [${target.id}] ${target.nickname}`);

    const place = await client.query<{ place_name: string; latitude: number; longitude: number }>(
      `SELECT place_name, latitude, longitude FROM promises
       WHERE creator_id = $1 AND title = 'Test1'
       ORDER BY id DESC LIMIT 1`,
      [target.id],
    );
    const testPlace = place.rows[0];
    if (!testPlace) {
      console.error(`'${TARGET_NICKNAME}' 계정으로 만든 'Test1' 약속을 찾을 수 없습니다. 먼저 사이트에서 만들어주세요.`);
      process.exit(1);
    }
    console.log(`장소: ${testPlace.place_name} (${testPlace.latitude}, ${testPlace.longitude})`);

    const profileCounters: Record<Profile, number> = { punctual: 0, late: 0, mixed: 0 };
    let created = 0;

    for (const member of MEMBERS) {
      const friendId = await ensureVirtualUser(client, member.nickname);
      await ensureFriendship(client, target.id, friendId);

      const scenarioSet = PROFILE_SCENARIOS[member.profile];
      const scenario = scenarioSet[profileCounters[member.profile] % scenarioSet.length]!;
      profileCounters[member.profile] += 1;

      await client.query("BEGIN");
      for (let i = 0; i < scenario.length; i++) {
        const lateMinutes = scenario[i]!;
        const promisedAt = new Date(Date.now() - (scenario.length - i) * HOURS_BETWEEN * 60 * 60 * 1000);
        const settleDueAt = new Date(promisedAt.getTime() + NO_SHOW_MINUTES * 60_000);

        const inserted = await client.query<{ id: string }>(
          `INSERT INTO promises (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id::text`,
          [
            target.id,
            `${member.nickname}와의 약속 #${i + 1}`,
            testPlace.place_name,
            testPlace.latitude,
            testPlace.longitude,
            promisedAt,
            settleDueAt,
          ],
        );
        const promiseId = inserted.rows[0]!.id;

        await client.query(
          `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
           VALUES ($1, $2, 'accepted', now(), $3)`,
          [promiseId, target.id, promisedAt],
        );

        const friendCheckinAt = lateMinutes === null ? null : new Date(promisedAt.getTime() + lateMinutes * 60_000);
        await client.query(
          `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at, checkin_at)
           VALUES ($1, $2, 'accepted', now(), $3)`,
          [promiseId, friendId, friendCheckinAt],
        );

        created += 1;
      }
      await client.query("COMMIT");
      console.log(`${member.nickname} (${member.profile}): 약속 ${scenario.length}개 생성`);
    }

    console.log(`\n총 ${created}개 약속 생성. 정산 실행 중...`);
    const result = await runSettlementNow({});
    console.log(`정산 완료: settled=${result.settledIds.length} failed=${result.failedIds.length}`);
    if (result.failedIds.length > 0) {
      console.error("실패 목록:", result.failedIds);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
