import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

const DURATION_MS = 500;
const FLASH_MS = 700;

/**
 * 값이 바뀔 때 이전 값에서 새 값으로 숫자를 굴리듯 카운트업하고,
 * 배경을 잠깐 반짝여(flash) 변화가 있었음을 눈에 띄게 알린다.
 * 텍스트 색은 건드리지 않아 호출부의 inline color(등락색 등)와 충돌하지 않는다.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString(),
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    if (from === value) return;

    setFlash(value > from ? "up" : "down");
    const start = performance.now();
    let rafId: number;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    prevRef.current = value;

    const flashTimer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(flashTimer);
    };
  }, [value]);

  return (
    <span
      className={`animated-number${flash ? ` animated-number--${flash}` : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {format(display)}
    </span>
  );
}
