import { useState, type ButtonHTMLAttributes, type MouseEvent } from "react";

interface RippleSpot {
  id: number;
  x: number;
  y: number;
  size: number;
}

/** 클릭 지점에서 퍼지는 리플 효과가 있는 버튼. props는 기본 button과 동일하게 사용. */
export function RippleButton({
  className,
  onMouseDown,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [ripples, setRipples] = useState<RippleSpot[]>([]);

  function handleMouseDown(e: MouseEvent<HTMLButtonElement>) {
    if (!e.currentTarget.disabled) {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      setRipples((rs) => [
        ...rs,
        {
          id: Date.now() + Math.random(),
          x: e.clientX - rect.left - size / 2,
          y: e.clientY - rect.top - size / 2,
          size,
        },
      ]);
    }
    onMouseDown?.(e);
  }

  return (
    <button
      {...rest}
      className={`ripple-btn${className ? ` ${className}` : ""}`}
      onMouseDown={handleMouseDown}
    >
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-btn__ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          onAnimationEnd={() => setRipples((rs) => rs.filter((x) => x.id !== r.id))}
        />
      ))}
    </button>
  );
}
