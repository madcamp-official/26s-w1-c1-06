interface InlineToastProps {
  toastKey: number;
  message: string;
  tone?: "success" | "error";
}

/** 액션 직후 잠깐 떴다 사라지는 인라인 알림. toastKey를 바꿔주면 같은 문구도 재생된다. */
export function InlineToast({ toastKey, message, tone = "success" }: InlineToastProps) {
  return (
    <p key={toastKey} className={`inline-toast inline-toast--${tone}`} role="status">
      {tone === "success" ? "✅ " : "⚠️ "}
      {message}
    </p>
  );
}
