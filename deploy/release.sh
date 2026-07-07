#!/usr/bin/env bash
# Latestock 빌드 & 릴리스 (M0-6 / M5-1). /opt/latestock 에서 실행.
# 사용: bash deploy/release.sh
set -euo pipefail

cd /opt/latestock
git pull --ff-only

echo "== 의존성 설치 =="
npm install

echo "== 빌드 (shared → api) =="
npm run build --workspace @latestock/shared
npm run build --workspace @latestock/api

echo "== 카카오맵 키 확인 =="
# apps/web/.env는 git 미추적(.gitignore) — VM에 최초 1회 수동 생성 필요.
# Vite가 빌드 시 이 파일을 자동으로 읽으므로(envDir=apps/web) 여기서는 "존재/비어있지 않음"만 검증한다.
# 검증 없이 넘어가면 빌드는 성공하지만 배포본 지도가 빈 화면으로 뜨는 채로 조용히 배포되므로,
# 여기서 즉시 멈춰서 그 조용한 실패를 막는다.
WEB_ENV_FILE="apps/web/.env"
if ! grep -qE '^VITE_KAKAO_JS_KEY=.+' "$WEB_ENV_FILE" 2>/dev/null; then
  echo "!! ${WEB_ENV_FILE}에 VITE_KAKAO_JS_KEY가 없거나 비어 있습니다." >&2
  echo "!! Kakao Developers > 앱 설정 > 앱 키 > JavaScript 키를 복사해 다음 줄을 추가하세요:" >&2
  echo "!!   echo 'VITE_KAKAO_JS_KEY=<발급받은 키>' >> ${WEB_ENV_FILE}" >&2
  echo "!! (이 키가 없으면 빌드는 되지만 배포본 지도가 빈 화면으로 뜹니다.)" >&2
  exit 1
fi

echo "== 프런트 빌드 (같은 오리진의 /api 로 호출하도록 base 비움) =="
VITE_API_BASE_URL="" npm run build --workspace @latestock/web

echo "== 정적 산출물 배치 =="
mkdir -p /var/www/latestock/web
rm -rf /var/www/latestock/web/*
cp -r apps/web/dist/* /var/www/latestock/web/

echo "== 서비스 재시작 =="
systemctl restart latestock-api
systemctl reload nginx || systemctl restart nginx

echo "== 헬스 체크 =="
sleep 1
curl -fsS http://127.0.0.1:4000/api/health && echo " <- API OK"
