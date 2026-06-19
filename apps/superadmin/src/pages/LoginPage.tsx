import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CrestlyLogo, Icon } from "@crestly/icons";
import { BrandDot } from "@/components/BrandDot";
import { api, getErrorMessage } from "@/lib/api";
import { adminStore, useSuperAuth } from "@/lib/auth-store";
import type { SuperLoginResponse } from "@crestly/shared";

export function LoginPage() {
  const { token } = useSuperAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { data } = await api.post<SuperLoginResponse>("/superadmin/auth/login", { email, password });
      adminStore.set(data.accessToken, {
        ...data.admin,
        status: "active",
        createdAt: null,
      });
      navigate("/", { replace: true });
    } catch (e) {
      setErr(getErrorMessage(e, "Invalid email or password"));
    } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--cream-soft)", padding: 16 }}>
      <form
        className="card"
        onSubmit={onSubmit}
        style={{ width: "100%", maxWidth: 380 }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, background: "var(--ink)", borderRadius: 12, marginBottom: 12 }}>
            <CrestlyLogo width={32} height={32} />
          </div>
          <div className="display-s">Crestly Platform<BrandDot /></div>
          <p className="muted body-s" style={{ marginTop: 4 }}>Super-admin sign in</p>
        </div>

        <div className="form-grid form-grid--1" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label className="field__label">Email</label>
            <input
              type="email"
              className="input"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && (
            <div className="banner banner--error">
              <Icon name="alert" size={16} />
              <span>{err}</span>
            </div>
          )}
          <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
