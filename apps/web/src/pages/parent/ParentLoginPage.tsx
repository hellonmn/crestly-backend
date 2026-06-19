import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CrestlyLogo, Icon } from "@crestly/icons";
import { api, getErrorMessage } from "@/lib/api";
import { parentAuthStore, useParentAuth } from "@/lib/parent-auth-store";
import { BrandDot } from "@/components/BrandDot";
import type { ParentLoginResponse } from "@crestly/shared";

/* ============================================================
   Parent portal login — direct port of erp/parent/login.php.

   - Phone: any number on the child's record (father / mother /
     WhatsApp / calling / guardian). 10 digits, +91 prefix shown
     as a sticky non-input.
   - DOB:  child's DOB as DDMMYYYY, e.g. "08072008" for 8 July 2008.
   - On submit, server expands to siblings via family_id so the
     parent doesn't log in once per child.

   Layout deliberately stays single-column and centred — most
   parents land here from a WhatsApp link on their phone.
   ============================================================ */

export function ParentLoginPage() {
  const { token } = useParentAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [phone, setPhone] = useState("");
  const [dob, setDob]     = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy]   = useState(false);

  /* School name for the page header — the parent has no token yet, so we
     hit the dedicated public /parent/school-info route (not the auth-
     gated admin /school-info). */
  const { data: school } = useQuery({
    queryKey: ["parent-school-info"],
    staleTime: 5 * 60_000,
    retry: false,                  // don't retry on the login page
    queryFn: async () => (await api.get<{ name: string }>("/parent/school-info")).data,
  });
  const schoolName = school?.name?.trim() || "School";

  if (token) {
    // Already logged in — bounce to the parent home (will exist in a
    // subsequent commit). For now `/parent/` is the only route, so any
    // logged-in parent sees the home screen there.
    return <Navigate to={sp.get("next") || "/parent/"} replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post<ParentLoginResponse>("/parent/login", { phone, dob });
      parentAuthStore.set(data.accessToken, data.kids, data.parentLabel);
      navigate(sp.get("next") || "/parent/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Could not sign in. Please check the details."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <style>{PL_CSS}</style>
      <div className="pl">
        <div className="pl__card">
          <header className="pl__brand">
            <div className="pl__brand-logo" aria-hidden="true">
              <CrestlyLogo width={32} height={32} />
            </div>
            <div>
              <div className="pl__brand-name">
                Crestly<BrandDot />
              </div>
              <div className="pl__brand-sub">PARENT PORTAL</div>
            </div>
          </header>

          <div className="pl__school">{schoolName}</div>
          <p className="pl__lede">
            Sign in with your registered mobile number and your child's date of
            birth to see attendance, fees, and updates.
          </p>

          {error && (
            <div className="banner banner--error" style={{ marginBottom: 14 }}>
              <Icon name="alert" size={14} /><span>{error}</span>
            </div>
          )}

          <form className="pl__form" onSubmit={onSubmit} autoComplete="on">
            <div className="field">
              <label className="field__label field__label--req" htmlFor="phone">
                Mobile number
              </label>
              <div className="pl__phone">
                <span className="pl__phone-cc mono">+91</span>
                <input
                  id="phone"
                  className="input pl__phone-input"
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
              <span className="field__hint">
                Any mobile registered with the school — father, mother, WhatsApp, or guardian.
              </span>
            </div>

            <div className="field">
              <label className="field__label field__label--req" htmlFor="dob">
                Child's date of birth
              </label>
              <input
                id="dob"
                className="input mono pl__dob"
                type="tel"
                name="dob"
                value={dob}
                onChange={(e) => setDob(e.target.value.replace(/\D/g, "").slice(0, 8))}
                required
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                placeholder="08072008"
              />
              <span className="field__hint">
                8 digits as <span className="pl__dob-eg">DDMMYYYY</span> — e.g. 08072008 for 8 July 2008.
              </span>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--full pl__submit"
              disabled={busy}
            >
              {busy ? (
                <><span className="pl__spinner" aria-hidden="true" /> Signing in…</>
              ) : (
                <>Sign in <Icon name="chev-right" size={14} /></>
              )}
            </button>
          </form>

          <div className="pl__help">
            Trouble signing in? Please contact the school office. Make sure the
            mobile number you're trying matches the one given at admission.
          </div>
        </div>

        <div className="pl__credit">
          Powered by <b>Shadowbiz Startups</b><BrandDot />
        </div>
      </div>
    </>
  );
}

const PL_CSS = `
  .pl {
    background: var(--cream);
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 20px;
  }
  .pl__card {
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 18px;
    padding: 32px;
    width: 100%;
    max-width: 420px;
    box-shadow:
      0 1px 2px rgba(16,13,10,.04),
      0 12px 32px rgba(16,13,10,.06);
    animation: pl-fade-up .35s ease-out;
  }

  .pl__brand { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
  .pl__brand-logo {
    width: 48px; height: 48px;
    border-radius: 12px;
    background: var(--ink);
    color: var(--cream);
    display: grid; place-items: center;
  }
  .pl__brand-name {
    font-family: var(--font-display, system-ui);
    font-weight: 900; font-size: 22px; letter-spacing: -.025em;
  }
  .pl__brand-sub {
    font-family: var(--font-mono, monospace);
    font-size: 10px; letter-spacing: .14em;
    color: var(--ink-40); text-transform: uppercase;
  }

  .pl__school {
    font-family: var(--font-display, system-ui);
    font-weight: 700;
    font-size: 15px;
    color: var(--ink);
    margin-bottom: 4px;
  }
  .pl__lede {
    color: var(--ink-60);
    font-size: 13.5px;
    line-height: 1.5;
    margin: 0 0 18px;
  }

  .pl__form { display: flex; flex-direction: column; gap: 14px; }

  .pl__phone { position: relative; }
  .pl__phone-cc {
    position: absolute;
    left: 12px; top: 50%;
    transform: translateY(-50%);
    color: var(--ink-60);
    font-size: 13px;
    pointer-events: none;
    padding-right: 8px;
    border-right: 1px solid var(--rule);
    height: 18px;
    display: inline-flex; align-items: center;
  }
  .pl__phone-input { padding-left: 56px; letter-spacing: .04em; }

  .pl__dob { letter-spacing: .12em; font-size: 15px; }
  .pl__dob-eg {
    display: inline-block;
    padding: 2px 8px;
    background: var(--cream-soft);
    border-radius: 6px;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    color: var(--ink);
    letter-spacing: .04em;
  }

  .pl__submit {
    margin-top: 6px;
    display: inline-flex !important;
    align-items: center; justify-content: center;
    gap: 6px;
    height: 44px;
    font-size: 14px;
  }
  .pl__spinner {
    width: 14px; height: 14px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,.4);
    border-top-color: var(--cream);
    animation: pl-spin .8s linear infinite;
  }

  .pl__help {
    margin-top: 18px;
    padding-top: 18px;
    border-top: 1px solid var(--rule-soft);
    font-size: 12px;
    color: var(--ink-60);
    line-height: 1.6;
  }

  .pl__credit {
    margin-top: 18px;
    text-align: center;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: .05em;
    color: var(--ink-40);
  }
  .pl__credit b { color: var(--ink-60); font-weight: 600; }

  @media (max-width: 480px) {
    .pl { padding: 14px; }
    .pl__card { padding: 24px 22px; border-radius: 14px; }
  }

  @keyframes pl-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pl-spin { to { transform: rotate(360deg); } }
`;
