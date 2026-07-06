const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function assertPassword(password: string): string | null {
  if (password.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  return null;
}

export function assertNickname(nickname: string): string | null {
  const trimmed = nickname.trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    return "닉네임은 1~30자여야 합니다.";
  }
  return null;
}
