import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { BrandDot } from "@/components/BrandDot";
import { useAuth } from "@/lib/auth-store";

/* ------------------------------------------------------------------ */
/* Static reference constants — verbatim of erp/hostel/fees.php       */
/* ------------------------------------------------------------------ */

const ONE_TIME: Array<{ name: string; amount: number; refundable: boolean; note: string }> = [
  { name: "Hostel Admission Fee", amount: 15_000, refundable: false, note: "At joining hostel" },
  { name: "Caution Money",        amount: 20_000, refundable: true,  note: "Refunded on No-Dues at exit" },
];

const LODGING: Record<"Triple" | "Twin" | "Single", number> = {
  Triple: 50_000,
  Twin:   70_000,
  Single: 100_000,
};

const COMMON: Array<{ name: string; amount: number }> = [
  { name: "Mess / Boarding (4 meals/day)", amount: 70_000 },
  { name: "Laundry",                       amount: 7_000 },
  { name: "Activity & Care",               amount: 8_000 },
  { name: "Medical",                       amount: 3_000 },
  { name: "Security & Maintenance",        amount: 5_000 },
];

const DISCOUNTS: Array<{ position: string; tuition: number; lodging: number }> = [
  { position: "1st child", tuition: 0,  lodging: 0 },
  { position: "2nd child", tuition: 12, lodging: 8 },
  { position: "3rd child", tuition: 18, lodging: 16 },
];

const PAYMENT_TERMS: Array<{ k: string; v: React.ReactNode }> = [
  { k: "Q1 due",          v: "15 Apr" },
  { k: "Q2 due",          v: "15 Jul" },
  { k: "Q3 due",          v: "15 Oct" },
  { k: "Q4 due",          v: "15 Jan" },
  { k: "Annual upfront",  v: <span className="pill pill--success">6% discount</span> },
  { k: "Mid-year exit",   v: "Pro-rata lodging refund · 1-month notice fee" },
];

/* School fees per class — typically read from student_fees. Until the
   matrix join is wired up server-side, we fall back to the same
   placeholder per-class amounts the PHP page used during its initial
   build, so this card always renders. */
const CLASS_FEES: Array<{ cls: string; schoolFee: number }> = [
  { cls: "6th",  schoolFee: 95_000 },
  { cls: "7th",  schoolFee: 1_00_000 },
  { cls: "8th",  schoolFee: 1_05_000 },
  { cls: "9th",  schoolFee: 1_15_000 },
  { cls: "10th", schoolFee: 1_25_000 },
  { cls: "11th", schoolFee: 1_45_000 },
  { cls: "12th", schoolFee: 1_55_000 },
];

const Y1_EXTRA = 35_000;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function HostelFeesPage() {
  const { user } = useAuth();
  const sessionCode = (user as { sessionCode?: string } | null)?.sessionCode ?? null;
  const role = user?.roleSlug ?? "";
  const allowed = ["admin", "principal", "hr", "warden", "accountant"].includes(role);

  if (!allowed) {
    return (
      <>
        <PageHead group="HOSTEL" meta="FEES" title="Access denied" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>Hostel section is for Admin · Principal · HR · Warden · Accountant.</span>
        </div>
      </>
    );
  }

  const oneTimeTotal = ONE_TIME.reduce((s, r) => s + r.amount, 0);
  const commonTotal = COMMON.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <Link to="/hostel" className="m-back-link">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Hostel</span>
      </Link>

      <PageHead
        group="HOSTEL · FEES"
        meta={sessionCode ? `SESSION ${sessionCode}` : undefined}
        title="Hostel fees"
        lede="One-time charges at admission, annual lodging by room type, common services + class-wise school fee. Hostellers don't pay transport."
      />

      {/* ===== One-time charges ===== */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="label" style={{ marginBottom: 10 }}>ONE-TIME (YEAR 1 ONLY)</div>
        <div className="detail-list">
          {ONE_TIME.map((r) => (
            <div className="detail-row" key={r.name}>
              <span className="detail-row__k">{r.name}</span>
              <span className="detail-row__v">
                {money(r.amount)}
                <span className="muted body-s" style={{ marginLeft: 8 }}>· {r.note}</span>
                {r.refundable && (
                  <span className="pill pill--info" style={{ marginLeft: 6, padding: "1px 7px", fontSize: 10 }}>
                    Refundable
                  </span>
                )}
              </span>
            </div>
          ))}
          <div className="detail-row" style={{ background: "var(--cream-soft)" }}>
            <span className="detail-row__k" style={{ fontWeight: 600, color: "var(--ink)" }}>One-time total</span>
            <span className="detail-row__v" style={{ fontWeight: 700 }}>{money(oneTimeTotal)}</span>
          </div>
        </div>
      </div>

      {/* ===== Lodging + Common ===== */}
      <div className="grid grid--cols-2 grid--gap-sm">
        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="label" style={{ marginBottom: 10 }}>ANNUAL LODGING · BY ROOM TYPE</div>
          <div className="detail-list">
            {(Object.keys(LODGING) as Array<keyof typeof LODGING>).map((type) => (
              <div className="detail-row" key={type}>
                <span className="detail-row__k">{type} sharing</span>
                <span className="detail-row__v">{money(LODGING[type])}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="label" style={{ marginBottom: 10 }}>ANNUAL COMMON (SAME FOR ALL ROOMS)</div>
          <div className="detail-list">
            {COMMON.map((r) => (
              <div className="detail-row" key={r.name}>
                <span className="detail-row__k">{r.name}</span>
                <span className="detail-row__v">{money(r.amount)}</span>
              </div>
            ))}
            <div className="detail-row" style={{ background: "var(--cream-soft)" }}>
              <span className="detail-row__k" style={{ fontWeight: 600, color: "var(--ink)" }}>Common total</span>
              <span className="detail-row__v" style={{ fontWeight: 700 }}>{money(commonTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Class × Room type matrix ===== */}
      <div className="card" style={{ padding: "20px 24px", overflowX: "auto" }}>
        <div className="label" style={{ marginBottom: 10 }}>ANNUAL TOTAL · CLASS × ROOM TYPE</div>
        <p className="muted body-s" style={{ margin: "0 0 12px" }}>
          School fee + lodging + common. Year-1 column adds the {money(Y1_EXTRA)} one-time hostel charges.
        </p>
        <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th>CLASS</th>
              <th style={{ textAlign: "right" }}>SCHOOL FEE</th>
              <th style={{ textAlign: "right" }}>TRIPLE</th>
              <th style={{ textAlign: "right" }}>TWIN</th>
              <th style={{ textAlign: "right" }}>SINGLE</th>
              <th style={{ textAlign: "right" }}>+ YEAR-1 EXTRAS</th>
            </tr>
          </thead>
          <tbody>
            {CLASS_FEES.map((row) => {
              const tri    = row.schoolFee + LODGING.Triple + commonTotal;
              const twin   = row.schoolFee + LODGING.Twin   + commonTotal;
              const single = row.schoolFee + LODGING.Single + commonTotal;
              return (
                <tr key={row.cls}>
                  <td><span className="cls-pill">{row.cls}</span></td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(row.schoolFee)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(tri)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(twin)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{money(single)}</td>
                  <td className="mono" style={{ textAlign: "right", color: "var(--ink-60)" }}>
                    + {money(Y1_EXTRA)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ===== Sibling discount ===== */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="label" style={{ marginBottom: 10 }}>SIBLING DISCOUNT (AUTO-APPLIED)</div>
        <p className="muted body-s" style={{ margin: "0 0 10px" }}>
          When 2 or 3 siblings share the hostel — discount stacks on both school tuition AND hostel lodging.
        </p>
        <div className="detail-list">
          {DISCOUNTS.map((d) => (
            <div className="detail-row" key={d.position}>
              <span className="detail-row__k">{d.position}</span>
              <span className="detail-row__v">
                {d.tuition === 0 ? (
                  <span className="muted">Full fee</span>
                ) : (
                  <>
                    <span className="pill pill--success" style={{ padding: "1px 8px", fontSize: 11 }}>
                      – {d.tuition}%
                    </span>
                    <span className="muted body-s" style={{ margin: "0 4px" }}>tuition</span>
                    <span className="pill pill--info" style={{ padding: "1px 8px", fontSize: 11 }}>
                      – {d.lodging}%
                    </span>
                    <span className="muted body-s" style={{ marginLeft: 4 }}>lodging</span>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Payment terms ===== */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="label" style={{ marginBottom: 10 }}>PAYMENT TERMS<BrandDot /></div>
        <div className="detail-list">
          {PAYMENT_TERMS.map((t) => (
            <div className="detail-row" key={t.k}>
              <span className="detail-row__k">{t.k}</span>
              <span className="detail-row__v">{t.v}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
