import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import {
  datetimeLocalToIso,
  defaultPromisedAtLocal,
} from "../lib/datetime-local";
import {
  checkinPromise,
  createPromise,
  demoSettle,
  listFriends,
  listPositions,
  listPromises,
  seedDemoNotifications,
} from "../lib/endpoints";
import type { FriendView, PromiseView } from "../types/api";

export function DemoScreen() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [promises, setPromises] = useState<PromiseView[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const [title, setTitle] = useState("데모 약속");
  const [placeName, setPlaceName] = useState("테스트 장소");
  const [latitude, setLatitude] = useState(37.5665);
  const [longitude, setLongitude] = useState(126.978);
  const [promisedAt, setPromisedAt] = useState(defaultPromisedAtLocal);
  const [inviteUserId, setInviteUserId] = useState("");
  const [promiseId, setPromiseId] = useState("");
  const [busy, setBusy] = useState(false);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 8));
  }, []);

  const refreshPromises = useCallback(async () => {
    try {
      const { promises: list } = await listPromises();
      setPromises(list);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void listFriends()
      .then(({ friends: f }) => setFriends(f))
      .catch(() => appendLog("친구 목록 로드 실패"));
    void refreshPromises();
  }, [appendLog, refreshPromises]);

  async function runAction(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      appendLog(`${label} 성공`);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "실패";
      appendLog(`${label} 실패: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    await runAction("약속 생성", async () => {
      const iso = datetimeLocalToIso(promisedAt);
      const { id } = await createPromise({
        title,
        placeName,
        latitude,
        longitude,
        promisedAt: iso,
        inviteUserIds: inviteUserId ? [inviteUserId] : [],
      });
      setPromiseId(id);
      await refreshPromises();
    });
  }

  async function handleCheckin() {
    if (!promiseId) {
      appendLog("약속 ID를 먼저 선택하세요.");
      return;
    }
    await runAction("GPS 인증", async () => {
      await checkinPromise(promiseId, latitude, longitude);
    });
  }

  async function handleSettle() {
    if (!promiseId) {
      appendLog("약속 ID를 먼저 선택하세요.");
      return;
    }
    await runAction("강제 정산", async () => {
      const p = promises.find((x) => x.id === promiseId);
      const settleAt = p
        ? new Date(new Date(p.settleDueAt).getTime() + 60_000)
        : new Date(Date.now() + 61 * 60_000);
      const result = await demoSettle({
        promiseId,
        now: settleAt.toISOString(),
      });
      appendLog(
        `정산: settled=${result.settledIds.join(",") || "없음"} skipped=${result.skippedIds.join(",") || "없음"}`,
      );
      await refreshPromises();
    });
  }

  async function handleSeedNotifications() {
    setBusy(true);
    try {
      await seedDemoNotifications();
      appendLog("알림 4종류 만들기 성공");
      navigate("/notifications");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : "실패";
      appendLog(`알림 4종류 만들기 실패: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleViewResult() {
    if (!promiseId) {
      appendLog("약속 ID를 선택하세요.");
      return;
    }
    setBusy(true);
    try {
      const { positions } = await listPositions("settled");
      const mine = positions.find((p) => p.promiseId === promiseId);
      if (mine) {
        navigate(`/results/position/${mine.id}`);
      } else {
        navigate(`/results/stock/${promiseId}`);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "결과 이동 실패";
      appendLog(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen demo-screen">
      <header className="screen-header">
        <h1>데모 컨트롤</h1>
        <p className="screen-header__sub">
          Storybook Controls처럼 값을 조정하고 시연 루프를 실행합니다.
        </p>
      </header>

      <div className="demo-panels">
        <section className="control-panel">
          <h2 className="control-panel__title">약속 설정</h2>
          <label className="field">
            <span>제목</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>장소명</span>
            <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} />
          </label>
          <label className="field">
            <span>위도</span>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>경도</span>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>약속 시각</span>
            <input
              type="datetime-local"
              value={promisedAt}
              onChange={(e) => setPromisedAt(e.target.value)}
            />
          </label>
          <label className="field">
            <span>초대 친구 (선택)</span>
            <select
              value={inviteUserId}
              onChange={(e) => setInviteUserId(e.target.value)}
            >
              <option value="">없음</option>
              {friends.map((f) => (
                <option key={f.userId} value={f.userId}>
                  {f.nickname} ({f.currentPrice.toLocaleString()}원)
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void handleCreate()}
          >
            약속 만들기
          </button>
        </section>

        <section className="control-panel">
          <h2 className="control-panel__title">실행</h2>
          <label className="field">
            <span>약속 ID</span>
            <select
              value={promiseId}
              onChange={(e) => setPromiseId(e.target.value)}
            >
              <option value="">선택...</option>
              {promises.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.id.slice(0, 6)}…)
                </option>
              ))}
            </select>
          </label>
          <div className="demo-actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleCheckin()}
            >
              인증하기
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleSettle()}
            >
              강제 정산
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={busy || !promiseId}
              onClick={() => void handleViewResult()}
            >
              결과 보기
            </button>
          </div>
        </section>

        <section className="control-panel">
          <h2 className="control-panel__title">알림 시연</h2>
          <p className="promise-form__hint">
            정산 확인 2종·친구요청·약속초대까지 알림함 4종류를 한 번에 만들어 보여줍니다.
          </p>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy}
            onClick={() => void handleSeedNotifications()}
          >
            알림 4종류 만들기
          </button>
        </section>

        <section className="control-panel control-panel--log">
          <h2 className="control-panel__title">로그</h2>
          <ul className="demo-log">
            {log.length === 0 ? (
              <li className="demo-log__empty">아직 실행 기록이 없습니다.</li>
            ) : (
              log.map((line) => (
                <li key={line}>{line}</li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
