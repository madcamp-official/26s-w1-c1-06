# 협업 규약 (M0-1)

> `기능명세서.md`(기능 명세서 v7)와 `구현계획.md`(구현 계획서 v1)이 설계의 원본이다. 본 문서는 **협업/커밋 규약**만 다룬다.

## 브랜치 전략

- `main` : 항상 배포 가능한 상태. **직접 push 금지 — PR + 리뷰 필수.**
- `feature/*` : 기능 단위 작업 브랜치 (예: `feature/m0-2-monorepo`, `feature/m1.0-settlement-engine`).
- 병합은 PR로만. 셀프 머지 금지(2인 팀 → 상대 리뷰 1회 필수).

### main 브랜치 보호 설정 (원격 레포 생성 후)

GitHub → Settings → Branches → Add rule (`main`):
- Require a pull request before merging (Require approvals: 1)
- Do not allow bypassing the above settings

> 검증: 빈 PR을 하나 열어 리뷰 없이 머지 불가한지 확인 (구현계획 M0-1).

## 커밋 규약 (5종)

`<type>: <요약>` 형식. type은 아래 5종만 사용한다.

| type | 용도 |
| --- | --- |
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 동작 변화 없는 코드 구조 개선 |
| `chore` | 빌드/설정/의존성 등 잡무 |

예시:

```
feat: F-05 GPS 도착 인증 엔드포인트 추가
fix: 정산 멱등 키 누락으로 이중 정산되던 문제 수정
chore: 모노레포 스캐폴딩 및 공유 상수 구성
```

## 이슈 라벨 (태스크 보드)

`feat` / `fix` / `docs` / `chore` 라벨로 태스크를 관리한다. 각 마일스톤 태스크(M0-1 … M5-4)를 이슈로 등록해 진행 상황을 추적한다.

## 레포 구조

```
Latestock/
├─ apps/
│  ├─ web/        # Vite + React + TS (프런트엔드)
│  └─ api/        # Express + TS (백엔드 + 정산 스케줄러)
├─ packages/
│  └─ shared/     # FE·BE 공유 타입/상수/공용 가드 (M0-2/M0-5)
├─ README.md       # 과제 제출용 프로젝트 README (GitHub 메인)
├─ 기능명세서.md    # 기능 명세서 v7
├─ 구현계획.md     # 구현 계획서 v1
└─ CONTRIBUTING.md
```

## 로컬 개발

```bash
npm install                # 루트에서 전체 워크스페이스 설치
npm run dev:api            # API 서버 (기본 :4000)
npm run dev:web            # 웹 개발 서버 (기본 :5173)
npm test                   # 전체 유닛 테스트 (shared 가드 등)
npm run typecheck          # 전체 타입 체크
```

환경 변수는 `.env.example`을 복사해 `.env`로 채운다. `.env`는 절대 커밋하지 않는다.
