const STORAGE_KEY = "latestock:favorite-stocks";

function readAll(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeAll(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

/** 관심종목(즐겨찾기) — 백엔드 없이 localStorage로만 관리 (M2-3). */
export function getFavorites(): string[] {
  return readAll();
}

export function isFavorite(userId: string): boolean {
  return readAll().includes(userId);
}

export function toggleFavorite(userId: string): string[] {
  const current = readAll();
  const next = current.includes(userId)
    ? current.filter((id) => id !== userId)
    : [...current, userId];
  writeAll(next);
  return next;
}
