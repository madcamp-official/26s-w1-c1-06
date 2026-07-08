import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, AuthLink } from "../components/AuthLayout";
import { ClassmateLoginHelper } from "../components/ClassmateLoginHelper";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export function LoginScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "로그인에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="다시 오신 것을 환영합니다"
      subtitle="Latestock 계정으로 로그인하세요"
      footer={
        <p>
          계정이 없으신가요? <AuthLink to="/signup">무료로 가입하기</AuthLink>
        </p>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthField
          id="login-email"
          label="이메일"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          icon="email"
        />
        <AuthField
          id="login-password"
          label="비밀번호"
          type="password"
          placeholder="8자 이상"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          icon="lock"
        />

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          type="submit"
          className="auth-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "로그인 중..." : "로그인"}
        </button>
      </form>

      <ClassmateLoginHelper
        onUseCredentials={(foundEmail, foundPassword) => {
          setEmail(foundEmail);
          setPassword(foundPassword);
        }}
      />
    </AuthLayout>
  );
}
