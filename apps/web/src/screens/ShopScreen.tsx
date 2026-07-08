import { useCallback, useEffect, useState } from "react";
import { AsyncState } from "../components/AsyncState";
import { ShopBadgeIcon } from "../components/ShopBadgeIcon";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { equipShopItem, getShopState, purchaseShopItem } from "../lib/endpoints";
import type { ShopCatalogItemView, ShopStateView } from "../types/api";

type ShopTab = "title" | "badge";

const TABS: { key: ShopTab; label: string }[] = [
  { key: "title", label: "칭호" },
  { key: "badge", label: "배지" },
];

const RARITY_LABEL: Record<ShopCatalogItemView["rarity"], string> = {
  rare: "레어",
  epic: "에픽",
  legendary: "레전더리",
  mythic: "신화",
};

export function ShopScreen() {
  const { user, refreshUser } = useAuth();
  const [tab, setTab] = useState<ShopTab>("title");
  const [state, setState] = useState<ShopStateView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getShopState()
      .then(setState)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "상점 정보를 불러오지 못했습니다.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePurchase(item: ShopCatalogItemView) {
    setActionError(null);
    setPendingKey(item.key);
    try {
      await purchaseShopItem(item.key);
      load();
      await refreshUser();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "구매에 실패했습니다.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleEquipToggle(item: ShopCatalogItemView) {
    setActionError(null);
    setPendingKey(item.key);
    try {
      await equipShopItem(item.type, item.equipped ? null : item.key);
      load();
      await refreshUser();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "장착 처리에 실패했습니다.");
    } finally {
      setPendingKey(null);
    }
  }

  const items = state?.items.filter((i) => i.type === tab) ?? [];

  function lockedReason(item: ShopCatalogItemView): string | null {
    if (item.type !== "badge" || item.owned || item.tier === undefined || item.tier <= 1) {
      return null;
    }
    const prevBadge = state?.items.find((i) => i.type === "badge" && i.tier === item.tier! - 1);
    if (prevBadge && !prevBadge.owned) {
      return `먼저 '${prevBadge.label}'을(를) 구매하세요`;
    }
    return null;
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>상점</h1>
        <p className="screen-header__sub">포인트로 칭호·배지를 사서 프로필을 꾸며보세요.</p>
        {user && (
          <p className="screen-header__sub">
            매수 가능 <strong>{user.availablePoints.toLocaleString()}P</strong>
          </p>
        )}
      </header>

      <div className="shop-tabs" role="tablist" aria-label="상점 탭">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`shop-tabs__item${tab === t.key ? " shop-tabs__item--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionError && (
        <p className="modal-box__error" role="alert" style={{ margin: "0 0 12px" }}>
          {actionError}
        </p>
      )}

      <AsyncState
        loading={!state && !error}
        error={error}
        onRetry={load}
        empty={items.length === 0}
        emptyIcon="🎁"
        emptyTitle="표시할 항목이 없어요"
      >
        <div className="shop-grid">
          {items.map((item) => {
            const isPending = pendingKey === item.key;
            const locked = lockedReason(item);
            return (
              <div key={item.key} className={`shop-card shop-card--${item.rarity}`}>
                <ShopBadgeIcon item={item} size={56} />
                <p className="shop-card__label">{item.label}</p>
                <span className="shop-card__rarity">{RARITY_LABEL[item.rarity]}</span>
                <strong className="shop-card__price">{item.price.toLocaleString()}P</strong>
                {item.owned ? (
                  <button
                    type="button"
                    className={`btn ${item.equipped ? "btn--secondary" : "btn--primary"} shop-card__btn`}
                    disabled={isPending}
                    onClick={() => handleEquipToggle(item)}
                  >
                    {isPending ? "처리 중..." : item.equipped ? "장착 해제" : "장착하기"}
                  </button>
                ) : locked ? (
                  <>
                    <button type="button" className="btn btn--secondary shop-card__btn" disabled>
                      🔒 잠김
                    </button>
                    <p className="shop-card__locked-hint">{locked}</p>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary shop-card__btn"
                    disabled={isPending}
                    onClick={() => handlePurchase(item)}
                  >
                    {isPending ? "구매 중..." : "구매하기"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </AsyncState>
    </div>
  );
}
