import { useState } from "react";

export interface PlaceSearchResult {
  lat: number;
  lng: number;
  placeName: string;
}

interface PlaceSearchBoxProps {
  onSelect: (result: PlaceSearchResult) => void;
}

/**
 * 키워드로 장소를 검색해 목록에서 고르면 좌표/이름을 돌려주는 컴포넌트 (SC-08 보강).
 * 이 컴포넌트는 좌표를 직접 소유하지 않는다 — 선택 결과를 onSelect로만 전달하고,
 * 실제 state 관리는 호출부(PromiseCreateScreen)가 담당한다.
 */
export function PlaceSearchBox({ onSelect }: PlaceSearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<kakao.maps.services.PlacesSearchResult>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleSearch() {
    if (searching) return;
    const keyword = query.trim();
    if (keyword.length < 1) return;

    if (typeof kakao === "undefined" || !kakao.maps.services) {
      setResults([]);
      setSearchError("지도 서비스를 불러오지 못했습니다.");
      return;
    }

    setSearching(true);
    setSearchError(null);

    const places = new kakao.maps.services.Places();
    places.keywordSearch(keyword, (data, status) => {
      setSearching(false);
      if (status === kakao.maps.services.Status.OK) {
        setResults(data);
      } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
        setResults([]);
        setSearchError("검색 결과가 없습니다.");
      } else {
        setResults([]);
        setSearchError("검색 중 오류가 발생했습니다.");
      }
    });
  }

  function handlePick(item: kakao.maps.services.PlacesSearchResultItem) {
    onSelect({
      lat: Number(item.y),
      lng: Number(item.x),
      placeName: item.place_name,
    });
    setResults([]);
    setQuery(item.place_name);
  }

  return (
    <div className="place-search">
      <div className="place-search__form">
        <input
          className="place-search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          placeholder="장소명으로 검색 (예: 강남역, OO카페)"
          maxLength={100}
        />
        <button type="button" className="btn btn--secondary" onClick={handleSearch} disabled={searching}>
          {searching ? "검색 중..." : "검색"}
        </button>
      </div>

      {searchError && <p className="promise-form__error">{searchError}</p>}

      {results.length > 0 && (
        <ul className="place-search__results">
          {results.map((item) => (
            <li key={item.id}>
              <button type="button" className="place-search__result" onClick={() => handlePick(item)}>
                <span className="place-search__result-name">{item.place_name}</span>
                <span className="place-search__result-address">
                  {item.road_address_name || item.address_name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
