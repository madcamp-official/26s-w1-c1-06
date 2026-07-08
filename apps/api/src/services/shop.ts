import { findShopItem, SHOP_ITEMS, type ShopItemType } from "@latestock/shared";
import { getPool } from "../db/pool.js";
import { HttpError, requirePool } from "../lib/errors.js";

export interface ShopCatalogItemView {
  key: string;
  label: string;
  type: ShopItemType;
  rarity: string;
  price: number;
  owned: boolean;
  equipped: boolean;
}

export interface ShopStateView {
  items: ShopCatalogItemView[];
  equippedTitleKey: string | null;
  equippedBadgeKey: string | null;
}

/** 상점 카탈로그 + 내 보유·장착 상태. */
export async function getShopState(userId: string): Promise<ShopStateView> {
  const pool = getPool();
  requirePool(pool);

  const [ownedResult, userResult] = await Promise.all([
    pool.query<{ item_key: string }>(
      `SELECT item_key FROM shop_purchases WHERE user_id = $1`,
      [userId],
    ),
    pool.query<{ equipped_title_key: string | null; equipped_badge_key: string | null }>(
      `SELECT equipped_title_key, equipped_badge_key FROM users WHERE id = $1`,
      [userId],
    ),
  ]);

  const ownedKeys = new Set(ownedResult.rows.map((r) => r.item_key));
  const user = userResult.rows[0];
  if (!user) throw new HttpError(404, "사용자를 찾을 수 없습니다.");

  const items = SHOP_ITEMS.map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    rarity: def.rarity,
    price: def.price,
    owned: ownedKeys.has(def.key),
    equipped:
      def.type === "title"
        ? user.equipped_title_key === def.key
        : user.equipped_badge_key === def.key,
  }));

  return {
    items,
    equippedTitleKey: user.equipped_title_key,
    equippedBadgeKey: user.equipped_badge_key,
  };
}

/** POST /shop/purchase — 보유 시 409, 포인트 부족 시 402. */
export async function purchaseShopItem(
  userId: string,
  itemKey: string,
): Promise<void> {
  const item = findShopItem(itemKey);
  if (!item) throw new HttpError(404, "존재하지 않는 상점 항목입니다.");

  const pool = getPool();
  requirePool(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<{ available_points: number }>(
      `SELECT available_points FROM users WHERE id = $1 FOR UPDATE`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user) throw new HttpError(404, "사용자를 찾을 수 없습니다.");
    if (user.available_points < item.price) {
      throw new HttpError(402, "가용 포인트가 부족합니다.");
    }

    await client.query(
      `INSERT INTO shop_purchases (user_id, item_key, item_type, price_paid)
       VALUES ($1, $2, $3, $4)`,
      [userId, item.key, item.type, item.price],
    );
    await client.query(
      `INSERT INTO point_transactions (user_id, amount, tx_type)
       VALUES ($1, $2, 'shop_purchase')`,
      [userId, -item.price],
    );
    await client.query(
      `UPDATE users SET available_points = available_points - $2 WHERE id = $1`,
      [userId, item.price],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err && typeof err === "object" && "code" in err && err.code === "23505") {
      throw new HttpError(409, "이미 보유한 항목입니다.");
    }
    throw err;
  } finally {
    client.release();
  }
}

/** POST /shop/equip — itemKey가 null이면 해당 슬롯 해제. 보유하지 않은 항목은 장착 불가. */
export async function equipShopItem(
  userId: string,
  itemType: ShopItemType,
  itemKey: string | null,
): Promise<void> {
  const pool = getPool();
  requirePool(pool);

  if (itemKey !== null) {
    const item = findShopItem(itemKey);
    if (!item || item.type !== itemType) {
      throw new HttpError(404, "존재하지 않는 상점 항목입니다.");
    }
    const owned = await pool.query(
      `SELECT 1 FROM shop_purchases WHERE user_id = $1 AND item_key = $2`,
      [userId, itemKey],
    );
    if ((owned.rowCount ?? 0) === 0) {
      throw new HttpError(403, "보유하지 않은 항목은 장착할 수 없습니다.");
    }
  }

  const column = itemType === "title" ? "equipped_title_key" : "equipped_badge_key";
  await pool.query(`UPDATE users SET ${column} = $2 WHERE id = $1`, [userId, itemKey]);
}
