import {
  canCheckin,
  maskParticipants,
  NO_SHOW_MINUTES,
  type InviteStatus,
  type MaskedParticipantView,
} from "@latestock/shared";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface CreatePromiseInput {
  title: string;
  placeName: string;
  latitude: number;
  longitude: number;
  promisedAt: Date;
  inviteUserIds: string[];
}

export interface PromiseView {
  id: string;
  creatorId: string;
  title: string;
  placeName: string;
  latitude: number;
  longitude: number;
  promisedAt: string;
  settleDueAt: string;
  settledAt: string | null;
  createdAt: string;
  myInviteStatus: InviteStatus;
}

type PromiseStatusFilter = "upcoming" | "ongoing" | "ended";

interface PromiseRow {
  id: string;
  creator_id: string;
  title: string;
  place_name: string;
  latitude: number;
  longitude: number;
  promised_at: Date;
  settle_due_at: Date;
  settled_at: Date | null;
  created_at: Date;
  my_invite_status: InviteStatus;
}

function mapPromise(row: PromiseRow): PromiseView {
  return {
    id: row.id,
    creatorId: row.creator_id,
    title: row.title,
    placeName: row.place_name,
    latitude: row.latitude,
    longitude: row.longitude,
    promisedAt: row.promised_at.toISOString(),
    settleDueAt: row.settle_due_at.toISOString(),
    settledAt: row.settled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    myInviteStatus: row.my_invite_status,
  };
}

function assertCoordinates(lat: number, lng: number): void {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new HttpError(400, "좌표 범위가 올바르지 않습니다.");
  }
}

async function isAcceptedFriend(
  client: pg.Pool | pg.PoolClient,
  userId: string,
  friendId: string,
): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND (
         (requester_id = $1::bigint AND addressee_id = $2::bigint)
         OR (requester_id = $2::bigint AND addressee_id = $1::bigint)
       )`,
    [userId, friendId],
  );
  return (result.rowCount ?? 0) > 0;
}

async function getPromiseParticipantStatus(
  client: pg.Pool | pg.PoolClient,
  promiseId: string,
  userId: string,
): Promise<InviteStatus | null> {
  const result = await client.query<{ invite_status: InviteStatus }>(
    `SELECT invite_status FROM promise_participants
     WHERE promise_id = $1 AND user_id = $2`,
    [promiseId, userId],
  );
  return result.rows[0]?.invite_status ?? null;
}

async function assertPromiseAccess(
  client: pg.Pool | pg.PoolClient,
  promiseId: string,
  userId: string,
): Promise<void> {
  const status = await getPromiseParticipantStatus(client, promiseId, userId);
  if (!status) {
    throw new HttpError(404, "약속을 찾을 수 없습니다.");
  }
}

function statusFilterClause(
  status: PromiseStatusFilter | undefined,
  now: Date,
): { sql: string; params: Date[] } {
  if (!status) return { sql: "", params: [] };
  switch (status) {
    case "upcoming":
      return {
        sql: ` AND p.promised_at > $2::timestamptz AND p.settled_at IS NULL`,
        params: [now],
      };
    case "ongoing":
      return {
        sql: ` AND p.promised_at <= $2::timestamptz AND p.settled_at IS NULL AND p.settle_due_at >= $2::timestamptz`,
        params: [now],
      };
    case "ended":
      return {
        sql: ` AND (p.settled_at IS NOT NULL OR p.settle_due_at < $2::timestamptz)`,
        params: [now],
      };
  }
}

const promiseSelect = `
  SELECT p.id, p.creator_id, p.title, p.place_name, p.latitude, p.longitude,
         p.promised_at, p.settle_due_at, p.settled_at, p.created_at,
         pp.invite_status AS my_invite_status
  FROM promises p
  JOIN promise_participants pp ON pp.promise_id = p.id AND pp.user_id = $1::bigint
`;

/** POST /promises (F-04) */
export async function createPromise(
  creatorId: string,
  input: CreatePromiseInput,
  now: Date = new Date(),
): Promise<{ id: string }> {
  const title = input.title.trim();
  const placeName = input.placeName.trim();
  if (title.length < 1 || title.length > 100) {
    throw new HttpError(400, "제목은 1~100자여야 합니다.");
  }
  if (placeName.length < 1 || placeName.length > 100) {
    throw new HttpError(400, "장소명은 1~100자여야 합니다.");
  }
  assertCoordinates(input.latitude, input.longitude);

  if (Number.isNaN(input.promisedAt.getTime())) {
    throw new HttpError(400, "약속 시각이 올바르지 않습니다.");
  }
  if (input.promisedAt.getTime() <= now.getTime()) {
    throw new HttpError(400, "약속 시각은 현재보다 미래여야 합니다.");
  }

  const uniqueInvites = [...new Set(input.inviteUserIds.map(String))].filter(
    (id) => id !== creatorId,
  );

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const inviteId of uniqueInvites) {
      const isFriend = await isAcceptedFriend(client, creatorId, inviteId);
      if (!isFriend) {
        throw new HttpError(
          400,
          `친구가 아닌 사용자는 초대할 수 없습니다. (userId: ${inviteId})`,
        );
      }
    }

    const settleDueAt = new Date(
      input.promisedAt.getTime() + NO_SHOW_MINUTES * 60_000,
    );

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO promises
         (creator_id, title, place_name, latitude, longitude, promised_at, settle_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        creatorId,
        title,
        placeName,
        input.latitude,
        input.longitude,
        input.promisedAt,
        settleDueAt,
      ],
    );
    const promiseId = inserted.rows[0]?.id;
    if (!promiseId) throw new HttpError(500, "약속 생성에 실패했습니다.");

    await client.query(
      `INSERT INTO promise_participants (promise_id, user_id, invite_status, responded_at)
       VALUES ($1, $2, 'accepted', now())`,
      [promiseId, creatorId],
    );

    for (const inviteId of uniqueInvites) {
      await client.query(
        `INSERT INTO promise_participants (promise_id, user_id, invite_status)
         VALUES ($1, $2, 'invited')`,
        [promiseId, inviteId],
      );
    }

    await client.query("COMMIT");
    return { id: promiseId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** GET /promises (F-04) */
export async function listPromises(
  userId: string,
  status?: PromiseStatusFilter,
  now: Date = new Date(),
): Promise<PromiseView[]> {
  const pool = getPool();
  requirePool(pool);

  const filter = statusFilterClause(status, now);
  const params: (string | Date)[] = [userId, ...filter.params];

  const result = await pool.query<PromiseRow>(
    `${promiseSelect}
     WHERE 1=1${filter.sql}
     ORDER BY p.promised_at DESC`,
    params,
  );

  return result.rows.map(mapPromise);
}

/** GET /promises/:id (F-04) */
export async function getPromise(
  userId: string,
  promiseId: string,
): Promise<PromiseView> {
  const pool = getPool();
  requirePool(pool);

  const result = await pool.query<PromiseRow>(
    `${promiseSelect}
     WHERE p.id = $2::bigint`,
    [userId, promiseId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new HttpError(404, "약속을 찾을 수 없습니다.");
  }
  return mapPromise(row);
}

/** POST /promises/:id/respond (F-19) */
export async function respondToInvite(
  userId: string,
  promiseId: string,
  action: "accept" | "decline",
  now: Date = new Date(),
): Promise<void> {
  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const promiseResult = await client.query<{
      promised_at: Date;
      settled_at: Date | null;
    }>(
      `SELECT promised_at, settled_at FROM promises WHERE id = $1 FOR UPDATE`,
      [promiseId],
    );
    const promise = promiseResult.rows[0];
    if (!promise) throw new HttpError(404, "약속을 찾을 수 없습니다.");
    if (promise.settled_at !== null) {
      throw new HttpError(409, "이미 정산된 약속입니다.");
    }
    if (promise.promised_at.getTime() <= now.getTime()) {
      throw new HttpError(409, "약속 시각이 지나 응답할 수 없습니다.");
    }

    const participant = await client.query<{
      invite_status: InviteStatus;
    }>(
      `SELECT invite_status FROM promise_participants
       WHERE promise_id = $1 AND user_id = $2 FOR UPDATE`,
      [promiseId, userId],
    );
    const row = participant.rows[0];
    if (!row) {
      throw new HttpError(403, "이 약속에 초대되지 않았습니다.");
    }
    if (row.invite_status !== "invited") {
      throw new HttpError(409, "이미 응답한 약속입니다.");
    }

    if (action === "accept") {
      await client.query(
        `UPDATE promise_participants
         SET invite_status = 'accepted', responded_at = $3
         WHERE promise_id = $1 AND user_id = $2`,
        [promiseId, userId, now],
      );
    } else {
      await client.query(
        `UPDATE promise_participants
         SET invite_status = 'declined', responded_at = $3
         WHERE promise_id = $1 AND user_id = $2`,
        [promiseId, userId, now],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** POST /promises/:id/checkin (F-05) */
export async function checkinToPromise(
  userId: string,
  promiseId: string,
  latitude: number,
  longitude: number,
  now: Date = new Date(),
): Promise<{ checkinAt: string }> {
  assertCoordinates(latitude, longitude);

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const promiseResult = await client.query<{
      latitude: number;
      longitude: number;
      created_at: Date;
      settle_due_at: Date;
      settled_at: Date | null;
    }>(
      `SELECT latitude, longitude, created_at, settle_due_at, settled_at
       FROM promises WHERE id = $1`,
      [promiseId],
    );
    const promise = promiseResult.rows[0];
    if (!promise) throw new HttpError(404, "약속을 찾을 수 없습니다.");
    if (promise.settled_at !== null) {
      throw new HttpError(409, "이미 정산된 약속입니다.");
    }

    const participant = await client.query<{ invite_status: InviteStatus }>(
      `SELECT invite_status FROM promise_participants
       WHERE promise_id = $1 AND user_id = $2`,
      [promiseId, userId],
    );
    const part = participant.rows[0];
    if (!part) {
      throw new HttpError(403, "이 약속의 참여자가 아닙니다.");
    }

    const guard = canCheckin({
      now,
      createdAt: promise.created_at,
      settleDueAt: promise.settle_due_at,
      promisedLocation: {
        lat: promise.latitude,
        lng: promise.longitude,
      },
      checkinLocation: { lat: latitude, lng: longitude },
      isAcceptedParticipant: part.invite_status === "accepted",
    });

    if (!guard.allowed) {
      if (guard.reason === "not_participant") {
        throw new HttpError(403, "수락한 참여자만 인증할 수 있습니다.");
      }
      if (guard.reason === "out_of_window") {
        throw new HttpError(409, "인증 가능 시간이 아닙니다.");
      }
      throw new HttpError(400, "약속 장소 반경(50m) 밖입니다.");
    }

    const updated = await client.query<{ checkin_at: Date }>(
      `UPDATE promise_participants
       SET checkin_at = $3
       WHERE promise_id = $1 AND user_id = $2
         AND invite_status = 'accepted'
         AND checkin_at IS NULL
       RETURNING checkin_at`,
      [promiseId, userId, now],
    );
    if (updated.rowCount === 0) {
      throw new HttpError(409, "이미 인증했거나 인증할 수 없습니다.");
    }

    await client.query("COMMIT");
    const checkinAt = updated.rows[0]!.checkin_at;
    return { checkinAt: checkinAt.toISOString() };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** GET /promises/:id/participants (F-05/F-06/F-19) */
export async function getPromiseParticipants(
  viewerId: string,
  promiseId: string,
  now: Date = new Date(),
): Promise<{
  promisedAt: string;
  participants: MaskedParticipantView[];
}> {
  const pool = getPool();
  requirePool(pool);

  await assertPromiseAccess(pool, promiseId, viewerId);

  const promiseResult = await pool.query<{ promised_at: Date }>(
    `SELECT promised_at FROM promises WHERE id = $1`,
    [promiseId],
  );
  const promisedAt = promiseResult.rows[0]!.promised_at;

  const result = await pool.query<{
    user_id: string;
    nickname: string;
    invite_status: InviteStatus;
    checkin_at: Date | null;
  }>(
    `SELECT pp.user_id, u.nickname, pp.invite_status, pp.checkin_at
     FROM promise_participants pp
     JOIN users u ON u.id = pp.user_id
     WHERE pp.promise_id = $1
     ORDER BY pp.user_id`,
    [promiseId],
  );

  const friendIds = new Set(
    (
      await pool.query<{ friend_id: string }>(
        `SELECT
           CASE
             WHEN f.requester_id = $1::bigint THEN f.addressee_id
             ELSE f.requester_id
           END AS friend_id
         FROM friendships f
         WHERE f.status = 'accepted'
           AND $1::bigint IN (f.requester_id, f.addressee_id)`,
        [viewerId],
      )
    ).rows.map((r) => r.friend_id),
  );

  const participants = result.rows.map((r) => ({
    userId: r.user_id,
    displayName: r.nickname,
    inviteStatus: r.invite_status,
    checkinAt: r.checkin_at,
    isFriendOfViewer: friendIds.has(r.user_id) || r.user_id === viewerId,
  }));

  return {
    promisedAt: promisedAt.toISOString(),
    participants: maskParticipants(
      participants,
      viewerId,
      promisedAt,
      now,
    ),
  };
}
