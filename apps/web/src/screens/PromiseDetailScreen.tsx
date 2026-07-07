import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { CustomOverlayMap, Map, MapMarker } from "react-kakao-maps-sdk";
import { AsyncState } from "../components/AsyncState";
import { ParticipantResultModal } from "../components/ParticipantResultModal";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import { checkinPromise, getPromise, getPromiseParticipants } from "../lib/endpoints";
import { GeolocationError, getCurrentPosition } from "../lib/geolocation";
import type { ParticipantStatusView, PromiseParticipantsView, PromiseView } from "../types/api";

const POLL_INTERVAL_MS = 8000;

function chipClassName(p: ParticipantStatusView): string {
  const classes = ["participant-chip"];
  if (p.isSelf) classes.push("participant-chip--self");
  if (p.inviteStatus === "declined" || p.inviteStatus === "auto_declined") {
    classes.push("participant-chip--declined");
  } else if (p.checkinMasked) {
    classes.push("participant-chip--masked");
  } else if (p.checkinAt) {
    classes.push("participant-chip--arrived");
  } else {
    classes.push("participant-chip--waiting");
  }
  return classes.join(" ");
}

export function PromiseDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [promise, setPromise] = useState<PromiseView | null>(null);
  const [participantsView, setParticipantsView] = useState<PromiseParticipantsView | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantStatusView | null>(null);

  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinError, setCheckinError] = useState<string | null>(null);

  /**
   * 최초 로드 실패와, 최초 로드 이후 8초 폴링 실패를 구분한다.
   * 구분하지 않으면 일시적인 네트워크 오류로 이미 그려진 화면 전체가
   * 에러 화면으로 뒤집히는 회귀가 생긴다 — 폴링 실패는 배너로만 알린다.
   */
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [{ promise: p }, participants] = await Promise.all([
        getPromise(id),
        getPromiseParticipants(id),
      ]);
      setPromise(p);
      setParticipantsView(participants);
      setInitialError(null);
      setPollError(null);
      hasLoadedRef.current = true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "약속 정보를 불러오지 못했습니다.";
      if (hasLoadedRef.current) {
        setPollError(message);
      } else {
        setInitialError(message);
      }
    } finally {
      setInitialLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (!id) return <Navigate to="/promises" replace />;

  const selfParticipant = participantsView?.participants.find((p) => p.isSelf) ?? null;
  const canCheckin =
    !!selfParticipant &&
    selfParticipant.inviteStatus === "accepted" &&
    !selfParticipant.checkinAt &&
    !promise?.settledAt;

  async function handleCheckin() {
    if (!id) return;
    setCheckinBusy(true);
    setCheckinError(null);
    try {
      const { latitude, longitude } = await getCurrentPosition();
      await checkinPromise(id, latitude, longitude);
      await load();
    } catch (err) {
      if (err instanceof GeolocationError) setCheckinError(err.message);
      else if (err instanceof ApiError) setCheckinError(err.message);
      else setCheckinError("GPS 인증에 실패했습니다.");
    } finally {
      setCheckinBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>
          ← 뒤로
        </button>
      </header>

      <AsyncState loading={initialLoading} error={initialError} onRetry={() => void load()}>
        {promise && participantsView && (
          <>
            {pollError && (
              <p className="promise-detail__poll-error">
                새로고침 실패: {pollError} (다음 새로고침에서 다시 시도합니다)
              </p>
            )}

            <div className="promise-detail__title-row">
              <h1>{promise.title}</h1>
              {promise.settledAt && <span className="promise-detail__badge">정산 완료</span>}
            </div>
            <p className="promise-detail__meta">
              {promise.placeName} · {new Date(promise.promisedAt).toLocaleString("ko-KR")}
            </p>

            <Map
              center={{ lat: promise.latitude, lng: promise.longitude }}
              style={{ width: "100%", height: "280px", borderRadius: "12px" }}
              level={4}
            >
              <MapMarker position={{ lat: promise.latitude, lng: promise.longitude }} />
              <CustomOverlayMap
                position={{ lat: promise.latitude, lng: promise.longitude }}
                yAnchor={1.3}
              >
                <div className="participant-panel">
                  {participantsView.participants.map((p) => (
                    <button
                      key={p.userId}
                      type="button"
                      className={chipClassName(p)}
                      onClick={() => setSelectedParticipant(p)}
                    >
                      {p.displayName}
                    </button>
                  ))}
                </div>
              </CustomOverlayMap>
            </Map>

            <div className="participant-legend">
              <span className="participant-legend__item participant-legend__item--arrived">도착</span>
              <span className="participant-legend__item participant-legend__item--waiting">대기</span>
              <span className="participant-legend__item participant-legend__item--masked">비공개</span>
              <span className="participant-legend__item participant-legend__item--declined">불참</span>
            </div>

            {canCheckin && (
              <div className="promise-detail__checkin">
                <button
                  type="button"
                  className="btn btn--primary btn--block"
                  disabled={checkinBusy}
                  onClick={() => void handleCheckin()}
                >
                  {checkinBusy ? "위치 확인 중..." : "GPS 인증하기"}
                </button>
                {checkinError && <p className="promise-form__error">{checkinError}</p>}
              </div>
            )}
          </>
        )}
      </AsyncState>

      {selectedParticipant && promise && user && (
        <ParticipantResultModal
          promise={promise}
          participant={selectedParticipant}
          viewerId={user.id}
          onClose={() => setSelectedParticipant(null)}
        />
      )}
    </div>
  );
}
