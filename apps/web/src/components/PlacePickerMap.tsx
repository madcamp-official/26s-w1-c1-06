import { CustomOverlayMap, Map } from "react-kakao-maps-sdk";

interface PlacePickerMapProps {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
  level?: number;
}

/**
 * 지도를 클릭해 약속 장소 좌표를 고르는 컴포넌트 (SC-08).
 * 좌표는 부모가 소유한다(단일 소스) — 검색/클릭 모두 동일한 onSelect로 귀결시켜
 * 부모가 두 입력 경로를 구분할 필요가 없게 한다.
 * isPanto로 좌표가 바뀔 때마다 카메라가 부드럽게 이동하고, 마커는 좌표를 key로 삼아
 * 리마운트시켜 CSS bounce 애니메이션을 매번 재생한다(Kakao Maps SDK엔 마커 바운스가 없음).
 */
export function PlacePickerMap({ latitude, longitude, onSelect, level = 3 }: PlacePickerMapProps) {
  return (
    <Map
      center={{ lat: latitude, lng: longitude }}
      isPanto
      style={{ width: "100%", height: "100%" }}
      level={level}
      onClick={(_map, mouseEvent) => {
        const latlng = mouseEvent.latLng;
        onSelect(latlng.getLat(), latlng.getLng());
      }}
    >
      <CustomOverlayMap position={{ lat: latitude, lng: longitude }} yAnchor={1}>
        <div key={`${latitude.toFixed(6)}-${longitude.toFixed(6)}`} className="promise-map-marker" aria-hidden>
          📍
        </div>
      </CustomOverlayMap>
    </Map>
  );
}
