/** datetime-local input용 로컬 시각 문자열 (UTC slice 사용 금지). */
export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultPromisedAtLocal(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  return toDatetimeLocalValue(d);
}

/** datetime-local 값 → ISO (서버 전송). */
export function datetimeLocalToIso(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    throw new Error("시각 형식이 올바르지 않습니다.");
  }
  return at.toISOString();
}
