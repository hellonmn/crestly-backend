import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Icon, CrestlyLogo, type IconName } from "@crestly/icons";
import { BrandDot } from "@/components/BrandDot";
import { adminStore, useSuperAuth } from "@/lib/auth-store";

interface NavEntry { to: string; end?: boolean; label: string; icon: IconName }

const NAV: { title?: string; items: NavEntry[] }[] = [
  { items: [{ to: "/", end: true, label: "Dashboard", icon: "dashboard" }] },
  {
    title: "Tenants",
    items: [
      { to: "/schools", label: "Schools", icon: "users" },
      { to: "/onboard", label: "Onboard", icon: "plus" },
      { to: "/upgrades", label: "Upgrades", icon: "features" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { to: "/catalog", label: "Features", icon: "library" },
      { to: "/pricing", label: "Pricing", icon: "rupee" },
    ],
  },
  {
    title: "Revenue",
    items: [
      { to: "/billing", label: "Billing", icon: "settings" },
      { to: "/ledger", label: "Ledger", icon: "ledger" },
      { to: "/enquiries", label: "Enquiries", icon: "admissions" },
    ],
  },
  {
    title: "Brand Studio",
    items: [
      { to: "/brand", label: "Studio", icon: "features" },
      { to: "/brand/settings", label: "Settings", icon: "settings" },
      { to: "/brand/guidelines", label: "Guidelines", icon: "library" },
    ],
  },
  {
    title: "Platform",
    items: [
      { to: "/admins", label: "Admins", icon: "team" },
      { to: "/account", label: "Account", icon: "user-check" },
    ],
  },
];

export function SuperShell() {
  const { admin } = useSuperAuth();
  const navigate = useNavigate();
  useEffect(() => { document.documentElement.classList.add("css-ready"); }, []);

  function logout() {
    adminStore.clear();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <div className="app">
        <aside className="app__nav" id="app-nav">
          <Link to="/" className="brand-block" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="brand-block__logo"><CrestlyLogo width={32} height={32} /></div>
            <div>
              <div className="brand-block__name">
                Platform<BrandDot />
              </div>
              <div className="brand-block__role">Super admin</div>
            </div>
          </Link>

          {NAV.map((group, i) => (
            <div key={i} className="nav-section">
              {group.title && <div className="nav-section__title label">{group.title}</div>}
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) => `nav-item ${isActive ? "is-active" : ""}`}
                >
                  <span className="nav-item__icon"><Icon name={it.icon} size={14} /></span>
                  <span className="nav-item__label">{it.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="user-block">
            <div className="user-block__name">{admin?.name ?? "—"}</div>
            <div className="user-block__role">PLATFORM ADMIN</div>
            <button onClick={logout} className="btn btn--ghost btn--sm" style={{ width: "100%", marginTop: 8 }}>
              <Icon name="logout" size={14} /> Sign out
            </button>
          </div>
        </aside>
        <main className="app__main"><Outlet /></main>
      </div>
      <footer className="app-credit" role="contentinfo">
        Crestly Platform · <strong>internal control plane</strong>
        <span className="app-credit__dot" />
      </footer>
    </>
  );
}
