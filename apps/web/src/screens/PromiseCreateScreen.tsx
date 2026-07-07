import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlacePickerMap } from "../components/PlacePickerMap";
import { PlaceSearchBox, type PlaceSearchResult } from "../components/PlaceSearchBox";
import { ApiError } from "../lib/api";
import { datetimeLocalToIso, defaultPromisedAtLocal } from "../lib/datetime-local";
import { createPromise, listFriends } from "../lib/endpoints";
import { GeolocationError, getCurrentPosition } from "../lib/geolocation";
import type { FriendView } from "../types/api";

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

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
      setErrorMsg("장소명을 입력해 주세요(지도를 클릭하면 자동 입력됩니다).");
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
      navigate("/promises");
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "약속 생성에 실패했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>새 약속</h1>
        <p className="screen-header__sub">지도를 클릭해 약속 장소를 고르고 친구를 초대하세요.</p>
      </header>

      <form className="promise-form" onSubmit={(e) => void handleSubmit(e)}>
        <PlaceSearchBox onSelect={handleSearchSelect} />

        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => void handleUseMyLocation()}
          disabled={locating || submitting}
        >
          {locating ? "위치 확인 중..." : "내 위치 사용"}
        </button>

        <PlacePickerMap
          latitude={latitude}
          longitude={longitude}
          onSelect={handleMapSelect}
          level={level}
        />

        <label className="field">
          <span>제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 저녁 약속"
            maxLength={100}
          />
        </label>

        <label className="field">
          <span>장소명</span>
          <input
            value={placeName}
            onChange={(e) => {
              setPlaceName(e.target.value);
              setPlaceNameTouched(true);
            }}
            placeholder="지도를 클릭하면 자동으로 채워집니다"
            maxLength={100}
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

        <div className="field">
          <span>초대할 친구</span>
          {friendsError && <p className="promise-form__error">{friendsError}</p>}
          {!friendsError && friends.length === 0 && (
            <p className="promise-form__hint">아직 친구가 없어요. 초대 없이도 약속을 만들 수 있어요.</p>
          )}
          {friends.length > 0 && (
            <ul className="promise-form__invite-list">
              {friends.map((f) => (
                <li key={f.userId}>
                  <label className="promise-form__invite-item">
                    <input
                      type="checkbox"
                      checked={inviteIds.has(f.userId)}
                      onChange={() => toggleInvite(f.userId)}
                    />
                    <span>{f.nickname}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {errorMsg && <p className="promise-form__error">{errorMsg}</p>}

        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? "만드는 중..." : "약속 만들기"}
        </button>
      </form>
    </div>
  );
}
