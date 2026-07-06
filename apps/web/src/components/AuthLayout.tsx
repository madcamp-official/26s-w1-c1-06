import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand__inner">
          <div className="auth-brand__logo">
            <span className="auth-brand__logo-icon" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M4 18V8l8-4 8 4v10l-8 4-8-4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M12 4v16M4 8l8 4 8-4" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <span className="auth-brand__logo-text">Latestock</span>
          </div>

          <h1 className="auth-brand__headline">
            친구의 약속,
            <br />
            <em>주식</em>으로 보세요.
          </h1>
          <p className="auth-brand__desc">
            GPS 인증과 정산으로 지각비 주식 시장을 즐기는 소셜 게임형 웹 서비스입니다.
          </p>

          <div className="auth-brand__stats">
            <div className="auth-brand__stat">
              <span className="auth-brand__stat-value">100,000P</span>
              <span className="auth-brand__stat-label">가입 보너스</span>
            </div>
            <div className="auth-brand__stat">
              <span className="auth-brand__stat-value">10,000원</span>
              <span className="auth-brand__stat-label">시작 주가</span>
            </div>
            <div className="auth-brand__stat">
              <span className="auth-brand__stat-value">실시간</span>
              <span className="auth-brand__stat-label">약속 정산</span>
            </div>
          </div>

          <div className="auth-brand__chart">
            <p className="auth-brand__chart-label">주가 변동 · 약속 정산 기반</p>
            <div className="auth-brand__bars" aria-hidden>
              <span style={{ height: "40%" }} />
              <span style={{ height: "55%" }} />
              <span style={{ height: "45%" }} />
              <span style={{ height: "70%" }} />
              <span style={{ height: "62%" }} />
              <span style={{ height: "85%" }} />
              <span style={{ height: "78%" }} />
              <span style={{ height: "100%" }} />
            </div>
            <p className="auth-brand__chart-note">랜덤 없음 — 판정만이 가격을 움직입니다</p>
          </div>
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-panel__inner">
          <header className="auth-form-header">
            <h2 className="auth-form-header__title">{title}</h2>
            <p className="auth-form-header__sub">{subtitle}</p>
          </header>

          {children}

          <footer className="auth-form-footer">{footer}</footer>

          <div className="auth-trust" aria-hidden>
            <span>256-bit SSL</span>
            <span>·</span>
            <span>GPS 인증</span>
            <span>·</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </main>
    </div>
  );
}

type FieldIcon = "email" | "user" | "lock";

interface AuthFieldProps {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  icon?: FieldIcon;
}

function FieldIconSvg({ icon }: { icon: FieldIcon }) {
  if (icon === "email") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 7l9 6 9-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === "user") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V8a4 4 0 118 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AuthField({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  icon,
}: AuthFieldProps) {
  return (
    <label className="auth-field" htmlFor={id}>
      <span className="auth-field__label">{label}</span>
      <div className="auth-field__wrap">
        {icon && (
          <span className="auth-field__icon">
            <FieldIconSvg icon={icon} />
          </span>
        )}
        <input
          id={id}
          className="auth-field__input"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required
        />
      </div>
    </label>
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="auth-link">
      {children}
    </Link>
  );
}
