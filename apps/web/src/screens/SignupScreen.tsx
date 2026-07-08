import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, AuthLink } from "../components/AuthLayout";
import { ClassmateLoginHelper } from "../components/ClassmateLoginHelper";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function SignupScreen() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(email, password, nickname);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "회원가입에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="계정 만들기"
      subtitle="가입 즉시 100,000P와 주식이 발행됩니다"
      footer={
        <p>
          이미 계정이 있으신가요? <AuthLink to="/login">로그인</AuthLink>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          id="signup-email"
          label="이메일"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          icon="email"
        />
        <AuthField
          id="signup-nickname"
          label="닉네임"
          type="text"
          placeholder="시장에 표시될 이름"
          value={nickname}
          onChange={setNickname}
          autoComplete="nickname"
          icon="user"
        />
        <AuthField
          id="signup-password"
          label="비밀번호"
          type="password"
          placeholder="8자 이상"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          icon="lock"
        />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "가입 중..." : "회원가입"}
        </button>
      </form>

      <ClassmateLoginHelper />
    </AuthLayout>
  );
}
