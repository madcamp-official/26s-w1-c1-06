import { MEME_LABEL_CRITERIA, MEME_LABELS } from "@latestock/shared";
import { MEME_BG_COLORS } from "../theme";

const ORDER: (keyof typeof MEME_LABELS)[] = [
  "ON_TIME",
  "LATE_1_10",
  "LATE_11_30",
  "LATE_31_PLUS",
  "NO_SHOW",
];

/** 정산 결과 밈 등급표 — 판정 구간별로 어떤 라벨이 뜨는지 안내(F-20, I-3). */
export function MemeLabelLegend() {
  return (
    <section className="meme-legend" aria-label="등급표 안내">
      <h2 className="section-title">등급표</h2>
      <ul className="meme-legend__list">
        {ORDER.map((key) => (
          <li
            key={key}
            className="meme-legend__row"
            style={{ background: MEME_BG_COLORS[key] }}
          >
            <span className="meme-legend__label">{MEME_LABELS[key]}</span>
            <span className="meme-legend__criteria">{MEME_LABEL_CRITERIA[key]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
