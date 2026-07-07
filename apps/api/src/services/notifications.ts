import { getUnconfirmedSettlements } from "./settlement-inbox.js";
import { listIncomingFriendRequests } from "./friends.js";
import { getPool } from "../db/pool.js";
import { requirePool } from "../lib/errors.js";

export type NotificationItem =
  | {
      type: "settlement_stock";
      promiseId: string;
      promiseTitle: string;
      at: string;
    }
  | {
      type: "settlement_investor";
      positionId: string;
      promiseId: string;
      promiseTitle: string;
      stockNickname: string;
      at: string;
    }
  | {
      type: "friend_request";
      requestId: string;
      requesterNickname: string;
      at: string;
    }
  | {
      type: "promise_invite";
      promiseId: string;
      promiseTitle: string;
      at: string;
    };

export interface NotificationsResult {
  items: NotificationItem[];
  totalCount: number;
}

interface PendingInviteRow {
  id: string;
  title: string;
  created_at: Date;
}

async function listPendingInvites(userId: string): Promise<PendingInviteRow[]> {
  const pool = getPool();
  requirePool(pool);
  const result = await pool.query<PendingInviteRow>(
    `SELECT p.id, p.title, p.created_at
     FROM promises p
     JOIN promise_participants pp ON pp.promise_id = p.id AND pp.user_id = $1
     WHERE pp.invite_status = 'invited' AND p.promised_at > now()
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return result.rows;
}

/**
 * GET /me/notifications (S-07 1차) — 미확인 정산 + 받은 친구요청 + 받은 약속초대를
 * 하나의 알림함으로 통합. 각 항목은 이미 존재하는 조회를 재사용한다(새 테이블 없음).
 */
export async function getNotifications(userId: string): Promise<NotificationsResult> {
  const [settlements, friendRequests, promiseInvites] = await Promise.all([
    getUnconfirmedSettlements(userId),
    listIncomingFriendRequests(userId),
    listPendingInvites(userId),
  ]);

  const items: NotificationItem[] = [
    ...settlements.asStock.map(
      (s): NotificationItem => ({
        type: "settlement_stock",
        promiseId: s.promiseId,
        promiseTitle: s.promiseTitle,
        at: s.promisedAt,
      }),
    ),
    ...settlements.asInvestor.map(
      (s): NotificationItem => ({
        type: "settlement_investor",
        positionId: s.positionId,
        promiseId: s.promiseId,
        promiseTitle: s.promiseTitle,
        stockNickname: s.stockNickname,
        at: s.settledAt,
      }),
    ),
    ...friendRequests.map(
      (r): NotificationItem => ({
        type: "friend_request",
        requestId: r.id,
        requesterNickname: r.requesterNickname,
        at: r.createdAt,
      }),
    ),
    ...promiseInvites.map(
      (p): NotificationItem => ({
        type: "promise_invite",
        promiseId: p.id,
        promiseTitle: p.title,
        at: p.created_at.toISOString(),
      }),
    ),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { items, totalCount: items.length };
}
