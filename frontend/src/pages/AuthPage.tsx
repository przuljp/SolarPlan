import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { ArrowIcon } from "../components/Icons";
import { ApiError } from "../lib/api";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const data = new FormData(event.currentTarget);

    try {
      if (isRegister) {
        await register({
          full_name: String(data.get("full_name")),
          email: String(data.get("email")),
          password: String(data.get("password")),
        });
      } else {
        await login({
          email: String(data.get("email")),
          password: String(data.get("password")),
        });
      }
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(destination || "/dashboard", { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Unable to connect to SolarPlan. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <h1>{isRegister ? "Create a clear plan for your roof." : "Welcome back."}</h1>
          <p>SolarPlan keeps roof details, documented panel choices, and energy estimates in one private workspace.</p>
        </div>
        <div className="auth-survey" aria-hidden="true"><span /><span /><span /><span /></div>
        <p className="auth-disclaimer">Preliminary energy planning · Results remain estimates</p>
      </section>
      <section className="auth-form-section">
        <div className="auth-form-wrap">
          <h2>{isRegister ? "Set up your SolarPlan account" : "Open your workspace"}</h2>
          <p className="form-intro">
            {isRegister ? "Use an email address you can access and a strong password." : "Enter the details you used when creating your account."}
          </p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit}>
            {isRegister && (
              <label>Full name<input name="full_name" autoComplete="name" minLength={2} maxLength={120} required /></label>
            )}
            <label>Email address<input name="email" type="email" autoComplete="email" required /></label>
            <label>
              Password
              <input name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 10 : 1} maxLength={128} required />
              {isRegister && <small>At least 10 characters, with uppercase, lowercase, and a number.</small>}
            </label>
            <button className="button button-primary button-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><span className="button-spinner" />Please wait…</> : <>{isRegister ? "Create account" : "Log in"}<ArrowIcon /></>}
            </button>
          </form>
          <p className="auth-switch">
            {isRegister ? "Already have an account?" : "New to SolarPlan?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
