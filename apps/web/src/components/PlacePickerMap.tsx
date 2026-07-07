import { Map, MapMarker } from "react-kakao-maps-sdk";

interface PlacePickerMapProps {
  latitude: number;
  longitude: number;
  onSelect: (lat: number, lng: number) => void;
}

/** 지도를 클릭해 약속 장소 좌표를 고르는 컴포넌트 (SC-08). 좌표는 부모가 소유한다(단일 소스). */
export function PlacePickerMap({ latitude, longitude, onSelect }: PlacePickerMapProps) {
  return (
    <Map
      center={{ lat: latitude, lng: longitude }}
      style={{ width: "100%", height: "280px", borderRadius: "12px" }}
      level={3}
      onClick={(_map, mouseEvent) => {
        const latlng = mouseEvent.latLng;
        onSelect(latlng.getLat(), latlng.getLng());
      }}
    >
      <MapMarker position={{ lat: latitude, lng: longitude }} />
    </Map>
  );
}
