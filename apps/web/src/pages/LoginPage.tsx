import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CrestlyLogo, Icon } from "@crestly/icons";
import { api, getErrorMessage } from "@/lib/api";
import { authStore, useAuth } from "@/lib/auth-store";
import { BrandDot } from "@/components/BrandDot";
import type { LoginResponse } from "@crestly/shared";

/* ============================================================
   Crestly login — split-screen on desktop, stacked on mobile.

   Left panel (brand hero):
     - Big logo + wordmark + tagline
     - 4 feature bullets that double as a 30-second product pitch
     - Subtle orange gradient + dot pattern
     - Footer credit

   Right panel (the form):
     - "Welcome back" heading + sub-line
     - Phone with sticky +91 prefix
     - Password with show/hide eye + Caps Lock warning
     - Loading-aware submit button (shows the brand spinner)
     - Error banner animates in, never CLS-shifts the form
     - Forgot-password help row at the bottom

   On ≤860px we collapse to a single column — the brand panel
   shrinks to a horizontal header strip so the form is the
   first thing the user sees.
   ============================================================ */

const FEATURES = [
  { icon: "timetable",   text: "Smart timetable allotment in one click" },
  { icon: "fee-ledger",  text: "Live fee tracking + WhatsApp receipts" },
  { icon: "users",       text: "Staff attendance with selfie + geofence" },
  { icon: "exams",       text: "Marks entry, results, printable marksheets" },
] as const;

export function LoginPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/login", { phone, password });
      authStore.set(data.accessToken, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Wrong mobile number or password."));
    } finally {
      setBusy(false);
    }
  }

  function onPasswordKey(e: React.KeyboardEvent<HTMLInputElement>) {
    // getModifierState only exists on real keyboard events; guards keep us
    // safe in test environments where it's missing.
    if (typeof e.getModifierState === "function") {
      setCapsOn(e.getModifierState("CapsLock"));
    }
  }

  return (
    <>
      <style>{LOGIN_CSS}</style>
      <div className="lp">
        {/* ============== LEFT: brand panel ============== */}
        <aside className="lp__hero" aria-hidden="true">
          <div className="lp__hero-bg" />
          <div className="lp__hero-inner">
            <div className="lp__brand">
              <div className="lp__brand-logo">
                <CrestlyLogo width={28} height={28} />
              </div>
              <span className="lp__brand-name">
                Crestly<BrandDot />
              </span>
            </div>

            <div className="lp__tagline">
              <h1 className="lp__tagline-h">Run your school,<br/>beautifully.</h1>
              <p className="lp__tagline-p">
                One tool for admissions, attendance, fees, timetables,
                results, and parent updates — built for Indian schools.
              </p>
            </div>

            <ul className="lp__features">
              {FEATURES.map((f) => (
                <li key={f.text} className="lp__feature">
                  <span className="lp__feature-ico">
                    <Icon name={f.icon} size={16} />
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>

            <div className="lp__hero-foot muted body-s">
              Powered by <b>Shadowbiz Startups</b><BrandDot />
            </div>
          </div>
        </aside>

        {/* ============== RIGHT: form panel ============== */}
        <main className="lp__form-wrap">
          <div className="lp__form-card">
            <header className="lp__head">
              <h2 className="lp__head-h">Welcome back</h2>
              <p className="lp__head-p">
                Sign in with your school mobile number and password.
              </p>
            </header>

            {/* Pre-allocate space so the form doesn't shift when an
                error appears. */}
            <div className="lp__err-slot" aria-live="polite">
              {error && (
                <div className="banner banner--error lp__err">
                  <Icon name="alert" size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <form className="lp__form" onSubmit={onSubmit} autoComplete="on">
              <div className="field">
                <label className="field__label field__label--req" htmlFor="phone">
                  Mobile number
                </label>
                <div className="lp__phone">
                  <span className="lp__phone-cc mono">+91</span>
                  <input
                    id="phone"
                    className="input lp__phone-input"
                    type="tel"
                    name="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={13}
                    autoComplete="tel"
                    pattern="[0-9 +]{10,13}"
                    placeholder="98765 43210"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field__label field__label--req" htmlFor="password">
                  Password
                </label>
                <div className="lp__pass">
                  <input
                    id="password"
                    className="input lp__pass-input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onPasswordKey}
                    onKeyUp={onPasswordKey}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="lp__pass-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icon name={showPassword ? "user-check" : "user"} size={14} />
                    <span className="lp__pass-toggle-label">
                      {showPassword ? "Hide" : "Show"}
                    </span>
                  </button>
                </div>
                {capsOn && (
                  <span className="lp__caps">
                    <Icon name="alert" size={11} /> Caps Lock is on.
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full lp__submit"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="lp__spinner" aria-hidden="true" />
                    Signing you in…
                  </>
                ) : (
                  <>Log in <Icon name="chev-right" size={14} /></>
                )}
              </button>
            </form>

            <footer className="lp__foot">
              Forgot your password? Ask your admin to reset it from
              {" "}<b>Team → Edit member</b>.
            </footer>
          </div>

          <div className="lp__credit muted body-s">
            © {new Date().getFullYear()} Crestly · School ERP
          </div>
        </main>
      </div>
    </>
  );
}

/* ============================================================ */

const LOGIN_CSS = `
  /* ---------- Page layout ---------- */
  .lp {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(420px, 1fr) minmax(360px, 1fr);
    background: var(--cream);
    color: var(--ink);
  }
  @media (max-width: 860px) {
    .lp { grid-template-columns: 1fr; }
  }

  /* ---------- LEFT: brand hero ---------- */
  .lp__hero {
    position: relative;
    overflow: hidden;
    color: var(--cream);
    isolation: isolate;
    display: flex;
    padding: 56px 56px 36px;
  }
  .lp__hero-bg {
    position: absolute; inset: 0;
    background:
      radial-gradient(circle at 18% 12%, rgba(255, 200, 140, .35), transparent 55%),
      radial-gradient(circle at 88% 88%, rgba(255, 110, 30, .35), transparent 55%),
      radial-gradient(circle at 100% 0%, rgba(255, 110, 30, .25), transparent 35%),
      linear-gradient(135deg, #1a1612 0%, #2b1d12 55%, #3a2410 100%);
    z-index: -1;
  }
  .lp__hero-bg::after {
    content: "";
    position: absolute; inset: 0;
    background-image: radial-gradient(rgba(255,255,255,.05) 1px, transparent 1px);
    background-size: 22px 22px;
    background-position: 0 0;
    opacity: .8;
  }
  .lp__hero-inner {
    width: 100%;
    max-width: 460px;
    margin: auto;
    display: flex;
    flex-direction: column;
    gap: 36px;
    animation: lp-fade-up .55s ease-out both;
  }

  .lp__brand {
    display: flex; align-items: center; gap: 12px;
  }
  .lp__brand-logo {
    width: 42px; height: 42px; border-radius: 12px;
    background: var(--cream);
    display: grid; place-items: center;
    color: var(--ink);
    box-shadow: 0 6px 14px rgba(0,0,0,.35);
  }
  .lp__brand-name {
    font-family: var(--font-display, system-ui);
    font-weight: 900;
    font-size: 22px;
    letter-spacing: -0.025em;
    color: var(--cream);
  }

  .lp__tagline-h {
    margin: 0 0 14px;
    font-family: var(--font-display, system-ui);
    font-weight: 800;
    font-size: clamp(34px, 4.2vw, 48px);
    line-height: 1.08;
    letter-spacing: -0.025em;
  }
  .lp__tagline-p {
    margin: 0;
    color: rgba(248, 240, 226, .72);
    font-size: 14.5px;
    line-height: 1.55;
    max-width: 420px;
  }

  .lp__features {
    list-style: none;
    padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 12px;
  }
  .lp__feature {
    display: flex; align-items: center; gap: 12px;
    font-size: 13.5px;
    color: rgba(248, 240, 226, .9);
  }
  .lp__feature-ico {
    flex-shrink: 0;
    width: 30px; height: 30px;
    border-radius: 8px;
    background: rgba(255, 110, 30, .18);
    color: #ffb586;
    display: grid; place-items: center;
    border: 1px solid rgba(255, 110, 30, .25);
  }

  .lp__hero-foot {
    margin-top: auto;
    color: rgba(248, 240, 226, .5);
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.04em;
  }
  .lp__hero-foot b { color: rgba(248, 240, 226, .75); font-weight: 600; }

  /* ---------- RIGHT: form panel ---------- */
  .lp__form-wrap {
    padding: 48px 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .lp__form-card {
    width: 100%;
    max-width: 400px;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 18px;
    padding: 32px;
    box-shadow:
      0 1px 2px rgba(16,13,10,.04),
      0 12px 32px rgba(16,13,10,.06);
    animation: lp-fade-up .55s .08s ease-out both;
  }

  .lp__head { margin-bottom: 22px; }
  .lp__head-h {
    margin: 0 0 6px;
    font-family: var(--font-display, system-ui);
    font-weight: 800;
    font-size: 24px;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .lp__head-p {
    margin: 0;
    color: var(--ink-60);
    font-size: 13.5px;
    line-height: 1.5;
  }

  /* Reserve space so error banner doesn't shift the form. */
  .lp__err-slot { min-height: 0; }
  .lp__err {
    margin-bottom: 14px;
    animation: lp-slide-down .22s ease-out;
  }

  .lp__form { display: flex; flex-direction: column; gap: 14px; }

  /* Phone with sticky +91 prefix. */
  .lp__phone { position: relative; }
  .lp__phone-cc {
    position: absolute;
    left: 12px; top: 50%;
    transform: translateY(-50%);
    color: var(--ink-60);
    font-size: 13px;
    pointer-events: none;
    padding-right: 8px;
    border-right: 1px solid var(--rule);
    height: 18px;
    display: inline-flex;
    align-items: center;
  }
  .lp__phone-input { padding-left: 56px; letter-spacing: .04em; }

  /* Password with show/hide toggle. */
  .lp__pass { position: relative; }
  .lp__pass-input { padding-right: 76px; letter-spacing: .15em; }
  .lp__pass-input::placeholder { letter-spacing: .25em; }
  .lp__pass-toggle {
    position: absolute;
    right: 6px; top: 50%;
    transform: translateY(-50%);
    height: 28px;
    padding: 0 10px;
    background: var(--cream-soft);
    border: 0;
    border-radius: 6px;
    color: var(--ink-60);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    display: inline-flex; align-items: center; gap: 4px;
    transition: background .12s ease, color .12s ease;
  }
  .lp__pass-toggle:hover { background: var(--cream); color: var(--ink); }
  .lp__pass-toggle-label { font-weight: 600; }
  @media (max-width: 380px) {
    .lp__pass-toggle-label { display: none; }
    .lp__pass-input { padding-right: 50px; }
  }

  .lp__caps {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 5px;
    color: #b45309;
    font-size: 11.5px;
  }

  .lp__submit {
    margin-top: 6px;
    display: inline-flex !important;
    align-items: center; justify-content: center;
    gap: 6px;
    height: 44px;
    font-size: 14px;
  }
  .lp__spinner {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,.4);
    border-top-color: var(--cream);
    animation: lp-spin .8s linear infinite;
  }

  .lp__foot {
    margin-top: 22px;
    padding-top: 18px;
    border-top: 1px solid var(--rule-soft);
    font-size: 12px;
    color: var(--ink-60);
    line-height: 1.55;
  }
  .lp__foot b { color: var(--ink); }

  .lp__credit {
    text-align: center;
    color: var(--ink-40);
    font-size: 11.5px;
    letter-spacing: .03em;
  }

  /* ---------- Mobile: stack ---------- */
  @media (max-width: 860px) {
    .lp__hero {
      padding: 28px 24px 24px;
      min-height: auto;
    }
    .lp__hero-inner { gap: 20px; max-width: none; }
    .lp__tagline-h { font-size: clamp(26px, 7vw, 34px); }
    .lp__tagline-p { font-size: 13px; }
    .lp__features { display: none; }
    .lp__hero-foot { display: none; }

    .lp__form-wrap { padding: 28px 18px 24px; }
    .lp__form-card { padding: 24px; border-radius: 14px; }
  }

  /* ---------- Animations ---------- */
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-slide-down {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-spin {
    to { transform: rotate(360deg); }
  }
`;
