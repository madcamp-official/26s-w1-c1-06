import { describe, expect, it } from "vitest";
import {
  assertNickname,
  assertPassword,
  isValidEmail,
} from "./validation.js";

describe("validation", () => {
  it("이메일 형식 검증", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
  });

  it("비밀번호 8자 미만 거부", () => {
    expect(assertPassword("short")).toMatch(/8자/);
    expect(assertPassword("longenough")).toBeNull();
  });

  it("닉네임 길이 검증", () => {
    expect(assertNickname("")).toMatch(/1~30/);
    expect(assertNickname("철수")).toBeNull();
  });
});
