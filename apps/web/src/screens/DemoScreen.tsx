import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";
import {
  datetimeLocalToIso,
  defaultPromisedAtLocal,
} from "../lib/datetime-local";
import {
  checkinPromise,
  createPromise,
  demoCheckin,
  demoSettle,
  listFriends,
  listPositions,
  listPromises,
} from "../lib/endpoints";
import type { FriendView, PromiseView } from "../types/api";

interface SelectablePromise {
  id: string;
  title: string;
  promisedAt: string;
  /** 내가 만들었거나 초대받아 참여 중인 약속이 아니라 투자자로 베팅만 한 약속. */
  investedOnly: boolean;
}

export function DemoScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [promises, setPromises] = useState<PromiseView[]>([]);
  const [investedPromises, setInvestedPromises] = useState<SelectablePromise[]>([]);
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
      const [{ promises: list }, { positions }] = await Promise.all([
        listPromises(),
        listPositions("open"),
      ]);
      setPromises(list);

      // 데모 화면의 약속 드롭다운은 원래 "내가 참여자인 약속"만 보여줬는데(listPromises),
      // 친구 약속에 투자자로 베팅만 한 경우엔 참여자가 아니라서 목록에 안 잡혀 강제 정산을
      // 걸 수 없었다. 보유 포지션(투자 중인 약속)도 합쳐서 선택 가능하게 한다.
      const ownIds = new Set(list.map((p) => p.id));
      const seen = new Set<string>();
      const invested: SelectablePromise[] = [];
      for (const pos of positions) {
        if (ownIds.has(pos.promiseId) || seen.has(pos.promiseId)) continue;
        seen.add(pos.promiseId);
        invested.push({
          id: pos.promiseId,
          title: pos.promiseTitle,
          promisedAt: pos.promisedAt,
          investedOnly: true,
        });
      }
      setInvestedPromises(invested);
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

  function forceSettleAt(): Date {
    const p = promises.find((x) => x.id === promiseId);
    return p
      ? new Date(new Date(p.settleDueAt).getTime() + 60_000)
      : new Date(Date.now() + 61 * 60_000);
  }

  async function handleSettle() {
    if (!promiseId) {
      appendLog("약속 ID를 먼저 선택하세요.");
      return;
    }
    await runAction("강제 정산", async () => {
      const result = await demoSettle({
        promiseId,
        now: forceSettleAt().toISOString(),
      });
      appendLog(
        `정산: settled=${result.settledIds.join(",") || "없음"} skipped=${result.skippedIds.join(",") || "없음"}`,
      );
      await refreshPromises();
    });
  }

  /**
   * 지각비 판정 등급표 빠른 시연 — 실제 체크인 시간창을 기다리지 않고 즉시 결과를 본다.
   * 노쇼는 실제 게임 룰(60분) 그대로, 체크인 없이 바로 강제 정산하면 이미 no_show로 판정된다.
   */
  async function handleLatePreset(lateMinutes: number) {
    if (!promiseId || !user) {
      appendLog("약속 ID를 먼저 선택하세요.");
      return;
    }
    await runAction(`${lateMinutes}분 지각 시연`, async () => {
      await demoCheckin({ promiseId, userId: user.id, lateMinutes });
      const result = await demoSettle({
        promiseId,
        now: forceSettleAt().toISOString(),
      });
      appendLog(
        `정산: settled=${result.settledIds.join(",") || "없음"} skipped=${result.skippedIds.join(",") || "없음"}`,
      );
      await refreshPromises();
    });
  }

  async function handleNoShowPreset() {
    if (!promiseId) {
      appendLog("약속 ID를 먼저 선택하세요.");
      return;
    }
    await runAction("노쇼 시연", async () => {
      const result = await demoSettle({
        promiseId,
        now: forceSettleAt().toISOString(),
      });
      appendLog(
        `정산: settled=${result.settledIds.join(",") || "없음"} skipped=${result.skippedIds.join(",") || "없음"}`,
      );
      await refreshPromises();
    });
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
              {investedPromises.length > 0 && (
                <optgroup label="투자자로 베팅만 한 약속(참여자 아님)">
                  {investedPromises.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.id.slice(0, 6)}…)
                    </option>
                  ))}
                </optgroup>
              )}
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
              onClick={() => navigate("/")}
            >
              🎉 홈에서 팝업 보기
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleViewResult()}
            >
              결과 보기
            </button>
          </div>
          <p className="promise-form__hint">
            &quot;결과 보기&quot;는 결과 화면으로 바로 이동하며 그 자리에서 정산을 확인 처리해
            컨페티 팝업이 뜰 기회를 건너뜁니다. 팝업을 보려면 정산 후 &quot;🎉 홈에서 팝업
            보기&quot;로 홈 화면에 가세요 — 아직 미확인 상태일 때만 뜹니다.
          </p>
        </section>

        <section className="control-panel">
          <h2 className="control-panel__title">빠른 시연</h2>
          <p className="screen-header__sub">
            실제 체크인 시간을 기다리지 않고 등급표의 판정 구간을 바로 확인합니다.
          </p>
          <div className="demo-actions">
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleLatePreset(1)}
            >
              1분 지각
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleLatePreset(2)}
            >
              2분 지각
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleLatePreset(3)}
            >
              3분 지각
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={busy || !promiseId}
              onClick={() => void handleNoShowPreset()}
            >
              노쇼
            </button>
          </div>
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
