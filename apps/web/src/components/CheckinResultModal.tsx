export type CheckinResultVariant = "success" | "out_of_radius";

interface CheckinResultModalProps {
  variant: CheckinResultVariant;
  distanceMeters?: number;
  onClose: () => void;
}

/**
 * GPS 인증 결과(성공/반경 밖)를 모달로 크게 보여준다.
 * 반경 밖일 때는 실제 거리(distanceMeters)를 함께 표시해 원인을 바로 알 수 있게 한다.
 */
export function CheckinResultModal({ variant, distanceMeters, onClose }: CheckinResultModalProps) {
  const isSuccess = variant === "success";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-box--result" onClick={(e) => e.stopPropagation()}>
        <div className="modal-box__header">
          <span className="modal-box__title">GPS 인증</span>
          <button type="button" className="modal-box__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="modal-box__result-icon" aria-hidden="true">
          {isSuccess ? "✅" : "❌"}
        </div>

        <p className="modal-box__result-title">
          {isSuccess ? "인증 성공!" : "약속 장소 밖이에요"}
        </p>

        {isSuccess ? (
          <p className="modal-box__hint">도착이 정상적으로 기록됐어요.</p>
        ) : (
          <>
            <p className="modal-box__hint">인증 반경은 약속 장소로부터 50m 이내예요.</p>
            {distanceMeters !== undefined && (
              <p className="modal-box__result-distance">
                현재 약속 장소로부터 약 <strong>{distanceMeters}m</strong> 떨어져 있어요.
              </p>
            )}
          </>
        )}

        <button type="button" className="btn btn--primary btn--block" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
