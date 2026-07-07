import { Map, MapMarker } from "react-kakao-maps-sdk";

interface PlacePickerMapProps {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
  level?: number;
}

/**
 * 지도를 클릭하거나 핀을 드래그해 약속 장소 좌표를 고르는 컴포넌트 (SC-08).
 * 좌표는 부모가 소유한다(단일 소스) — 클릭/드래그 모두 동일한 onSelect로 귀결시켜
 * 부모가 두 입력 경로를 구분할 필요가 없게 한다.
 */
export function PlacePickerMap({ latitude, longitude, onSelect, level = 3 }: PlacePickerMapProps) {
  return (
    <Map
      center={{ lat: latitude, lng: longitude }}
      style={{ width: "100%", height: "280px", borderRadius: "12px" }}
      level={level}
      onClick={(_map, mouseEvent) => {
        const latlng = mouseEvent.latLng;
        onSelect(latlng.getLat(), latlng.getLng());
      }}
    >
      <MapMarker
        position={{ lat: latitude, lng: longitude }}
        draggable
        onDragEnd={(marker) => {
          const position = marker.getPosition();
          onSelect(position.getLat(), position.getLng());
        }}
      />
    </Map>
  );
}
