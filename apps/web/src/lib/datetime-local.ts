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

function atTime(base: Date, hours: number, minutes = 0): Date {
  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** 오늘 저녁 7시(이미 지났으면 내일 저녁 7시)를 datetime-local 문자열로. */
export function todayEveningLocal(): string {
  const now = new Date();
  let target = atTime(now, 19);
  if (target.getTime() <= now.getTime()) {
    target = atTime(new Date(now.getTime() + 24 * 60 * 60 * 1000), 19);
  }
  return toDatetimeLocalValue(target);
}

/** 내일 정오를 datetime-local 문자열로. */
export function tomorrowNoonLocal(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return toDatetimeLocalValue(atTime(tomorrow, 12));
}

/** 이번 주(오늘 포함) 돌아오는 토요일 정오를 datetime-local 문자열로. */
export function nextWeekendLocal(): string {
  const now = new Date();
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
  const saturday = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
  return toDatetimeLocalValue(atTime(saturday, 12));
}
