export type GeolocationErrorReason =
  | "permission_denied"
  | "position_unavailable"
  | "timeout";

export class GeolocationError extends Error {
  constructor(
    public reason: GeolocationErrorReason,
    message: string,
  ) {
    super(message);
  }
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** 브라우저 GPS 예외 3종(권한 거부/측위 실패/시간 초과·오프라인)을 구분해 Promise로 감싼다 (F-05). */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(
        new GeolocationError(
          "position_unavailable",
          "이 기기/브라우저는 위치 정보를 지원하지 않습니다.",
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[GEO-DEBUG]", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new GeolocationError(
              "permission_denied",
              "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해 주세요.",
            ),
          );
        } else if (error.code === error.TIMEOUT) {
          reject(
            new GeolocationError(
              "timeout",
              "위치 확인이 시간 초과됐어요. 신호가 약하거나(실내) 오프라인일 수 있어요. 다시 시도해 주세요.",
            ),
          );
        } else {
          reject(
            new GeolocationError(
              "position_unavailable",
              "위치를 확인할 수 없습니다.",
            ),
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  });
}
