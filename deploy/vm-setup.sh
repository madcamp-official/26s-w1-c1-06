#!/usr/bin/env bash
# Latestock VM 초기 세팅 (M0-6). Ubuntu/Debian 계열 root 기준. 한 번만 실행.
# 사용: bash deploy/vm-setup.sh
set -euo pipefail

echo "== 1. 시스템 패키지 설치 (Node 20, PostgreSQL, Nginx, git) =="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get update
apt-get install -y nodejs postgresql nginx git

echo "== 2. PostgreSQL DB/유저 생성 =="
# ⚠️ 비밀번호는 실제 강한 값으로 교체하고, 아래 .env의 DATABASE_URL과 일치시킬 것.
DB_PASS="${DB_PASS:-change-me-db-pass}"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='latestock'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER latestock WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='latestock'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE latestock OWNER latestock;"

echo "== 3. 스키마 적용 (schema.sql → 실 DB) =="
PGPASSWORD="${DB_PASS}" psql -U latestock -d latestock -h 127.0.0.1 -f /opt/latestock/db/schema.sql

echo "== 4. (선택) 제약 검증 19/19 =="
echo "PGPASSWORD=<pw> psql -U latestock -d latestock -h 127.0.0.1 -f /opt/latestock/db/test_schema.sql"

echo "완료. 다음: .env 작성 → deploy/release.sh 실행 → systemd/nginx 등록"
