# 배포 런북 (KCLOUD VM + Cloudflare Tunnel)

> `deploy/vm-setup.sh`, `deploy/release.sh`, `deploy/nginx.conf`, `deploy/latestock-api.service`가
> 이미 준비되어 있다. 이 문서는 그걸 실제로 실행하는 순서 + 새로 추가되는 cloudflared 터널 단계를 정리한다.
>
> 최종 도메인: **`latestock.gjtjwns06.madcamp-kaist.org`**
> (기본 서브도메인 `subdomain=gjtjwns06` 아래에 `name=latestock` 호스트네임을 하나 만드는 방식 —
> 노션 7-5 `POST /v1/tunnels/hostnames`에 대응. `RECORD_NAME`/CNAME 방식이 아니라 터널 전용 API다.)

## 0. 사전 준비

- 노션 7절 확인 결과, 이 캠프의 터널 기능은 **HTTP ingress 전용**이고 `localPort`는 **1024~65535만
  허용**(80/22/5432 등은 막힘, 7-7). 그래서 nginx를 80이 아니라 **8080**에서 띄우도록 이미
  `deploy/nginx.conf`를 고쳐뒀다 — 외부 노출은 전부 터널이 처리하니 8080은 VM 로컬에만 열려 있으면 된다.
- 흐름 요약(노션 7-1·7-2·7-5): ① `cloudflared` 설치(VM당 최초 1회) → ② `POST /v1/tunnels`로 터널
  등록 + `installCommand` 실행(VM당 최초 1회, `cloudflared`가 systemd 서비스로 상시 등록됨) →
  ③ `POST /v1/tunnels/hostnames`로 `latestock.gjtjwns06.madcamp-kaist.org` ↔ `localhost:8080` 연결.
- Kakao Developers 콘솔 → 내 애플리케이션 → 플랫폼 → Web → 사이트 도메인에
  `https://latestock.gjtjwns06.madcamp-kaist.org` 추가. (키 발급과 별개 단계 — 안 하면 지도 빈 화면)

## 1. VM 최초 접속 & 코드 clone

```bash
ssh <VM계정>@<VM주소>
sudo mkdir -p /opt/latestock && sudo chown $USER /opt/latestock
git clone https://github.com/madcamp-official/26s-w1-c1-06.git /opt/latestock
cd /opt/latestock
```

## 2. 시스템 세팅 (Node/Postgres/Nginx 설치 + DB 생성)

**절대 이 값들을 git에 커밋하지 말 것** — 아래는 전부 VM 위에서만 생성·보관한다.

```bash
export DB_PASS="$(openssl rand -hex 16)"
echo "DB_PASS=$DB_PASS"   # 3단계 DATABASE_URL에 그대로 써야 하니 잊지 말고 적어두기
sudo -E bash deploy/vm-setup.sh
```

## 3. `.env` 파일 작성

```bash
JWT_SECRET="$(openssl rand -hex 32)"

cat > /opt/latestock/apps/api/.env <<EOF
PORT=4000
NODE_ENV=production
DEMO_MODE=true
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
DATABASE_URL=postgresql://latestock:${DB_PASS}@127.0.0.1:5432/latestock
CORS_ORIGIN=https://latestock.gjtjwns06.madcamp-kaist.org
EOF

cat > /opt/latestock/apps/web/.env <<'EOF'
VITE_KAKAO_JS_KEY=<Kakao Developers JavaScript 키>
EOF
```

> `DB_PASS`는 같은 쉘 세션이면 2단계에서 만든 값이 그대로 이어진다(세션이 끊겼다면 다시 export).
> `apps/api/.env`·`apps/web/.env`는 `.gitignore`에 걸려 있어 커밋되지 않는다 — 확인해서 안심하고 진행.
> **DEMO_MODE=true — 데모 강제정산 등 데모 전용 엔드포인트가 배포본에서도 열려 있다(발표용).**

## 4. cloudflared 설치 + 터널 등록 + 호스트네임 연결 (노션 7-1/7-2/7-5)

**0단계 — cloudflared 설치 (VM당 최초 1회)**

```bash
uname -m   # x86_64 → amd64, aarch64 → arm64. KCLOUD는 보통 amd64.

curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

**1~2단계 — 터널 등록 + 서비스 설치 (VM당 최초 1회)**

`POST /v1/tunnels`는 계정에 터널이 없으면 새로 만들고 있으면 기존 것을 반환하며,
`installCommand`(`sudo cloudflared service install <토큰>`)를 응답에 실어준다. 그 명령을
그대로 실행하면 cloudflared가 systemd 서비스(`cloudflared`)로 상시 등록된다.

```bash
set -a; source /opt/latestock/deploy/.env; set +a   # DNS_API_BASE, DNS_API_KEY 로드
sudo apt-get install -y jq   # 없으면

RESPONSE=$(curl -fsS -X POST -H "Authorization: Bearer $DNS_API_KEY" "$DNS_API_BASE/v1/tunnels")
echo "$RESPONSE"
INSTALL_CMD=$(echo "$RESPONSE" | jq -r '.installCommand')
eval "sudo $INSTALL_CMD"

sudo systemctl status cloudflared   # 정상 연결 확인
```

> VM을 새로 만들거나 밀었을 때는 0단계부터 다시 하고, 설치 명령만 다시 받고 싶으면
> `GET /v1/tunnels/token`(노션 7-4)을 쓴다 — 터널 자체를 새로 만들 필요는 없다.

**3단계 — 호스트네임을 로컬 포트에 연결 (서비스 코드가 바뀌어도 재실행 불필요, 최초 1회)**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $DNS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"subdomain": "gjtjwns06", "name": "latestock", "localPort": 8080}' \
  "$DNS_API_BASE/v1/tunnels/hostnames"
# → latestock.gjtjwns06.madcamp-kaist.org 가 VM의 localhost:8080(nginx)으로 연결됨
```

상태 확인은 `GET /v1/tunnels`(노션 7-3)로 언제든 가능하다.

## 5. nginx 배치

`deploy/nginx.conf`는 이미 8080/실도메인으로 맞춰뒀다(리포 파일 그대로 복사만 하면 됨):

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/latestock
sudo ln -sf /etc/nginx/sites-available/latestock /etc/nginx/sites-enabled/latestock
sudo nginx -t && sudo systemctl reload nginx
```

## 6. systemd 서비스 등록

```bash
sudo cp deploy/latestock-api.service /etc/systemd/system/latestock-api.service
sudo systemctl daemon-reload
sudo systemctl enable latestock-api
```

## 7. 첫 배포 실행

```bash
sudo bash deploy/release.sh
```

`release.sh`가 알아서: `git pull` → 의존성 설치 → shared/api 빌드 → 카카오 키 검증 →
프런트 빌드 → 정적 파일 배치 → `systemctl restart latestock-api` → nginx reload → 헬스체크까지 수행한다.

## 8. 최종 확인

```bash
curl -fsS http://127.0.0.1:4000/api/health
```

브라우저에서 `https://latestock.gjtjwns06.madcamp-kaist.org` 접속해 로그인 화면이 뜨는지 확인.

## 9. 다음 배포부터

코드 변경 후 재배포는 VM에서 이 한 줄이면 된다:

```bash
cd /opt/latestock && sudo bash deploy/release.sh
```

## 10. 마무리

- `README.md`의 "배포 결과물" 섹션에 서비스 URL과 실행 방법 채우기.
- 서브도메인을 반납하게 되면 `DELETE /v1/tunnels/hostnames/:id`로 먼저 호스트네임을 지워야
  `DELETE /v1/subdomains/:id`가 된다(노션 7-6) — 지금 당장 할 일은 아니고 참고용.
