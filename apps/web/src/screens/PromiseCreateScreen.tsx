import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InlineToast } from "../components/InlineToast";
import { PlacePickerMap } from "../components/PlacePickerMap";
import { PlaceSearchBox, type PlaceSearchResult } from "../components/PlaceSearchBox";
import { RippleButton } from "../components/RippleButton";
import { ApiError } from "../lib/api";
import {
  datetimeLocalToIso,
  defaultPromisedAtLocal,
  nextWeekendLocal,
  todayEveningLocal,
  tomorrowNoonLocal,
} from "../lib/datetime-local";
import { createPromise, listFriends } from "../lib/endpoints";
import { GeolocationError, getCurrentPosition } from "../lib/geolocation";
import type { FriendView } from "../types/api";

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

const TITLE_SUGGESTIONS = ["저녁 약속", "스터디", "카페 수다"];

const TIME_CHIPS: { label: string; getValue: () => string }[] = [
  { label: "오늘 저녁 7시", getValue: todayEveningLocal },
  { label: "내일 정오", getValue: tomorrowNoonLocal },
  { label: "이번 주말", getValue: nextWeekendLocal },
];

function reverseGeocode(
  lat: number,
  lng: number,
  onResult: (placeName: string) => void,
): void {
  if (typeof kakao === "undefined" || !kakao.maps.services) return;
  const geocoder = new kakao.maps.services.Geocoder();
  geocoder.coord2Address(lng, lat, (result, status) => {
    if (status !== kakao.maps.services.Status.OK || !result[0]) return;
    const name = result[0].road_address?.address_name ?? result[0].address.address_name;
    onResult(name);
  });
}

function formatPromisedAtDisplay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "미정";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PromiseCreateScreen() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeNameTouched, setPlaceNameTouched] = useState(false);
  const [latitude, setLatitude] = useState(DEFAULT_LAT);
  const [longitude, setLongitude] = useState(DEFAULT_LNG);
  const [level, setLevel] = useState(3);
  const [promisedAt, setPromisedAt] = useState(defaultPromisedAtLocal());

  const [friends, setFriends] = useState<FriendView[]>([]);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inviteIds, setInviteIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    listFriends()
      .then(({ friends: items }) => setFriends(items))
      .catch((err) => {
        setFriendsError(err instanceof Error ? err.message : "친구 목록을 불러오지 못했습니다.");
      });
  }, []);

  function handleMapSelect(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    if (!placeNameTouched) {
      reverseGeocode(lat, lng, setPlaceName);
    }
  }

  function handleSearchSelect(result: PlaceSearchResult) {
    setLatitude(result.lat);
    setLongitude(result.lng);
    setPlaceName(result.placeName);
    setPlaceNameTouched(true);
    setLevel(2);
  }

  async function handleUseMyLocation() {
    if (locating || submitting) return;
    setLocating(true);
    setErrorMsg(null);
    try {
      const { latitude: lat, longitude: lng } = await getCurrentPosition();
      handleMapSelect(lat, lng);
      setLevel(2);
    } catch (err) {
      setErrorMsg(
        err instanceof GeolocationError ? err.message : "현재 위치를 가져오지 못했습니다.",
      );
    } finally {
      setLocating(false);
    }
  }

  function toggleInvite(userId: string) {
    setInviteIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedPlace = placeName.trim();
    if (trimmedTitle.length < 1) {
      setErrorMsg("제목을 입력해 주세요.");
      return;
    }
    if (trimmedPlace.length < 1) {
      setErrorMsg("장소명을 입력해 주세요(지도를 클릭하거나 검색하면 자동 입력됩니다).");
      return;
    }

    let promisedAtIso: string;
    try {
      promisedAtIso = datetimeLocalToIso(promisedAt);
    } catch {
      setErrorMsg("약속 시각을 확인해 주세요.");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await createPromise({
        title: trimmedTitle,
        placeName: trimmedPlace,
        latitude,
        longitude,
        promisedAt: promisedAtIso,
        inviteUserIds: Array.from(inviteIds),
      });
      setToastMsg("약속을 만들었어요!");
      setToastKey((k) => k + 1);
      setTimeout(() => navigate("/promises"), 700);
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "약속 생성에 실패했습니다.",
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="promise-create">
      <div className="promise-create__form">
        <header className="screen-header">
          <h1>새 약속</h1>
          <p className="screen-header__sub">오른쪽 지도에서 장소를 고르고 친구를 초대하세요.</p>
        </header>

        <form className="promise-form" onSubmit={(e) => void handleSubmit(e)}>
          {placeName ? (
            <div className="promise-place-summary">
              <span className="promise-place-summary__icon" aria-hidden>
                📍
              </span>
              <strong className="promise-place-summary__name">{placeName}</strong>
              <button
                type="button"
                className="promise-place-summary__change"
                onClick={() => {
                  setPlaceName("");
                  setPlaceNameTouched(false);
                }}
              >
                변경
              </button>
            </div>
          ) : (
            <p className="promise-form__hint">오른쪽 지도를 클릭하거나 검색해서 장소를 골라주세요.</p>
          )}

          <label className="field">
            <span>제목</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 저녁 약속"
              maxLength={100}
            />
          </label>
          <div className="promise-chip-row">
            {TITLE_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="promise-chip" onClick={() => setTitle(s)}>
                {s}
              </button>
            ))}
          </div>

          <label className="field">
            <span>약속 시각</span>
            <input
              type="datetime-local"
              value={promisedAt}
              onChange={(e) => setPromisedAt(e.target.value)}
            />
          </label>
          <div className="promise-chip-row">
            {TIME_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="promise-chip"
                onClick={() => setPromisedAt(chip.getValue())}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="field">
            <span>
              초대할 친구{inviteIds.size > 0 ? ` · ${inviteIds.size}명 초대됨` : ""}
            </span>
            {friendsError && <p className="promise-form__error">{friendsError}</p>}
            {!friendsError && friends.length === 0 && (
              <p className="promise-form__hint">아직 친구가 없어요. 초대 없이도 약속을 만들 수 있어요.</p>
            )}
            {friends.length > 0 && (
              <div className="promise-invite-grid">
                {friends.map((f) => {
                  const selected = inviteIds.has(f.userId);
                  return (
                    <button
                      key={f.userId}
                      type="button"
                      className={`promise-invite-chip${selected ? " promise-invite-chip--selected" : ""}`}
                      onClick={() => toggleInvite(f.userId)}
                    >
                      <span className="promise-invite-chip__avatar">{f.nickname.slice(0, 1)}</span>
                      <span>{f.nickname}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {errorMsg && <p className="promise-form__error">{errorMsg}</p>}
          {toastMsg && <InlineToast toastKey={toastKey} message={toastMsg} />}

          <div className="promise-sticky-bar">
            <p className="promise-sticky-bar__summary">
              📍 {placeName || "장소 미정"} · 🕐 {formatPromisedAtDisplay(promisedAt)} · 👥{" "}
              {inviteIds.size}명
            </p>
            <RippleButton type="submit" className="btn btn--primary btn--block" disabled={submitting}>
              {submitting ? "만드는 중..." : "약속 만들기"}
            </RippleButton>
          </div>
        </form>
      </div>

      <div className="promise-create__map">
        <div className="promise-map-search">
          <PlaceSearchBox onSelect={handleSearchSelect} />
        </div>

        <PlacePickerMap latitude={latitude} longitude={longitude} onSelect={handleMapSelect} level={level} />

        <button
          type="button"
          className="promise-map-locate"
          onClick={() => void handleUseMyLocation()}
          disabled={locating || submitting}
          aria-label="내 위치 사용"
          title="내 위치 사용"
        >
          {locating ? "…" : "📍"}
        </button>
      </div>
    </div>
  );
}
