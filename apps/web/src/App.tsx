import { useEffect, useState } from "react";
import { BASE_STOCK_PRICE, INITIAL_POINTS, memeLabel } from "@latestock/shared";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

export function App() {
  const [health, setHealth] = useState<string>("확인 중...");

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then((d) => setHealth(`API: ${d.status}`))
      .catch(() => setHealth("API 연결 실패 (서버가 떠 있나요?)"));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", padding: 24, maxWidth: 560 }}>
      <h1>지각비 주식 시장 📉</h1>
      <p>M0 기반 세팅 스켈레톤 — 빈 앱이 뜨는지 확인용.</p>
      <ul>
        <li>기본 주가: {BASE_STOCK_PRICE.toLocaleString()}원</li>
        <li>초기 포인트: {INITIAL_POINTS.toLocaleString()}P</li>
        <li>32분 지각 밈 등급: {memeLabel(32, false)}</li>
      </ul>
      <p>
        <strong>{health}</strong>
      </p>
    </main>
  );
}
