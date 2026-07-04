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
