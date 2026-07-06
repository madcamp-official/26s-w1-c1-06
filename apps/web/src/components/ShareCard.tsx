import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  directionLabel,
  formatPoints,
  type SettlementResultVM,
} from "../lib/settlement-result";
import { FALL_COLOR, RISE_COLOR } from "../theme";

interface ShareCardProps {
  vm: SettlementResultVM;
  viewerNickname: string;
}

export function ShareCard({ vm, viewerNickname }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isInvestor = vm.kind === "investor";
  const payout = vm.payout ?? 0;
  const payoutColor =
    payout > 0 ? RISE_COLOR : payout < 0 ? FALL_COLOR : "#333";

  async function capturePng(): Promise<Blob> {
    if (!cardRef.current) throw new Error("카드를 찾을 수 없습니다.");
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return res.blob();
  }

  async function handleDownload() {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await capturePng();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `latestock-result-${vm.promiseId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("이미지를 저장했습니다.");
    } catch {
      setStatus("이미지 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await capturePng();
      const file = new File([blob], "latestock-result.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "지각비 주식 시장 정산 결과",
          text: `${vm.memeLabel} — ${vm.promiseTitle}`,
          files: [file],
        });
        setStatus("공유했습니다.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `latestock-result-${vm.promiseId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("이 브라우저는 파일 공유를 지원하지 않아 저장했습니다.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus("공유에 실패했습니다. 다운로드를 이용해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="share-section">
      <h2 className="section-title">공유 카드</h2>
      <p className="section-desc">듀올린고처럼 한눈에 보이는 성과 카드</p>

      <div className="share-card-wrap">
        <div ref={cardRef} className="share-card" data-testid="share-card">
          <div className="share-card__badge">Latestock</div>
          <p className="share-card__meme">{vm.memeLabel}</p>
          <p className="share-card__title">{vm.promiseTitle}</p>
          <p className="share-card__stock">{vm.stockDisplayName}</p>

          {isInvestor && vm.payout !== undefined && (
            <div className="share-card__stat">
              <span className="share-card__stat-label">실현 손익</span>
              <span
                className="share-card__stat-value"
                style={{ color: payoutColor }}
              >
                {formatPoints(vm.payout)}
              </span>
            </div>
          )}

          {!isInvestor && (
            <div className="share-card__stat">
              <span className="share-card__stat-label">정산가</span>
              <span className="share-card__stat-value">
                {vm.settledPrice.toLocaleString()}원
              </span>
            </div>
          )}

          {isInvestor && vm.direction && (
            <p className="share-card__meta">
              {directionLabel(vm.direction)} · {vm.quantity}주
            </p>
          )}

          <p className="share-card__footer">@{viewerNickname}</p>
        </div>
      </div>

      <div className="share-actions">
        <button
          type="button"
          className="btn btn--secondary"
          disabled={busy}
          onClick={() => void handleDownload()}
        >
          이미지 저장
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void handleShare()}
        >
          공유하기
        </button>
      </div>
      {status && <p className="share-status">{status}</p>}
    </div>
  );
}
