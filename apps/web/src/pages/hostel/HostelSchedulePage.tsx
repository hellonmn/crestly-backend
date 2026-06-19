import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { BrandDot } from "@/components/BrandDot";
import { useAuth } from "@/lib/auth-store";

/* ------------------------------------------------------------------ */
/* Static reference — verbatim of erp/hostel/schedule.php             */
/* ------------------------------------------------------------------ */

const WEEKDAY: Array<{ time: string; activity: string; incharge: string; location: string }> = [
  { time: "5:30 AM",           activity: "Wake-up bell",                incharge: "Night Watchman",      location: "Hostel rooms" },
  { time: "6:00 – 6:45 AM",    activity: "PT / Yoga / Morning walk",    incharge: "PE Instructor",       location: "Hostel ground" },
  { time: "7:30 – 8:15 AM",    activity: "Breakfast",                   incharge: "Mess Manager",        location: "Mess hall" },
  { time: "8:30 AM – 2:30 PM", activity: "School classes",              incharge: "School",              location: "School block" },
  { time: "2:30 – 3:15 PM",    activity: "Lunch",                       incharge: "Mess Manager",        location: "Mess" },
  { time: "4:30 PM",           activity: "Snacks",                      incharge: "Mess Server",         location: "Mess" },
  { time: "5:00 – 6:30 PM",    activity: "Sports / Co-curricular",      incharge: "PE Instructor",       location: "Playground" },
  { time: "7:00 – 7:30 PM",    activity: "Dinner",                      incharge: "Mess Manager",        location: "Mess" },
  { time: "7:30 – 9:30 PM",    activity: "Evening Prep (supervised)",   incharge: "Prep Supervisor",     location: "Study hall" },
  { time: "9:45 PM",           activity: "Roll Call · Lights-out prep", incharge: "Wardens",             location: "Rooms" },
];

const LIGHTS_OUT: Array<{ group: string; time: string }> = [
  { group: "Class 6 – 8",   time: "10:00 PM" },
  { group: "Class 9 – 10",  time: "10:30 PM" },
  { group: "Class 11 – 12", time: "11:00 PM" },
];

const WINDOWS: Array<{ k: string; v: string }> = [
  { k: "Parent video calls", v: "Tue / Thu / Sun · 5 – 6 PM" },
  { k: "Sunday outing",      v: "11 AM – 5 PM · with Asst. Warden or Local Guardian" },
  { k: "Evening Prep",       v: "Mon – Sat · 7:30 – 9:30 PM · supervised study" },
];

const RULES: Array<{ head: string; body: string }> = [
  { head: "No personal mobile phones",    body: "Phones surrendered at admission. Use hostel parent-call windows." },
  { head: "Visitor entry — Sundays only", body: "11 AM to 5 PM, pre-scheduled 24 hr in advance with the front office." },
  { head: "Campus exit",                  body: "Requires the authorised Local Guardian for pickup. No solo exits." },
  { head: "Anti-ragging",                 body: "Zero tolerance. Expulsion + police complaint on any incident." },
  { head: "No outside food",              body: "Swiggy / Zomato / personal orders blocked at the gate." },
  { head: "Valuables above ₹2,000",       body: "To be deposited in the hostel safe at the warden's desk." },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function HostelSchedulePage() {
  const { user } = useAuth();
  const role = user?.roleSlug ?? "";
  const allowed = ["admin", "principal", "hr", "warden", "accountant"].includes(role);

  if (!allowed) {
    return (
      <>
        <PageHead group="HOSTEL" meta="SCHEDULE & RULES" title="Access denied" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>Hostel section is for Admin · Principal · HR · Warden · Accountant.</span>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{SCHED_CSS}</style>

      <Link to="/hostel" className="m-back-link">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Hostel</span>
      </Link>

      <PageHead
        group="HOSTEL · SCHEDULE & RULES"
        title="Daily routine"
        lede="Weekday schedule, lights-out by class, parent-call windows, and the boarders' code of conduct. Read carefully — these apply to every hosteller."
      />

      {/* ===== Weekday schedule ===== */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="label" style={{ marginBottom: 10 }}>WEEKDAY DAILY SCHEDULE<BrandDot /></div>
        <div className="detail-list" style={{ fontSize: 13 }}>
          {WEEKDAY.map((row, i) => (
            <div
              key={i}
              className="detail-row sched-row"
            >
              <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{row.time}</span>
              <span>{row.activity}</span>
              <span className="muted body-s">{row.incharge}</span>
              <span className="muted body-s">{row.location}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Lights-out + Windows ===== */}
      <div className="grid grid--cols-2 grid--gap-sm">
        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="label" style={{ marginBottom: 10 }}>LIGHTS-OUT</div>
          <div className="detail-list">
            {LIGHTS_OUT.map((l) => (
              <div className="detail-row" key={l.group}>
                <span className="detail-row__k">{l.group}</span>
                <span className="detail-row__v">
                  <span className="mono" style={{ fontWeight: 600 }}>{l.time}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: "20px 24px" }}>
          <div className="label" style={{ marginBottom: 10 }}>PARENT &amp; OUTING WINDOWS</div>
          <div className="detail-list">
            {WINDOWS.map((w) => (
              <div className="detail-row" key={w.k}>
                <span className="detail-row__k">{w.k}</span>
                <span className="detail-row__v">{w.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Rules ===== */}
      <div className="card" style={{ padding: "20px 24px" }}>
        <div className="label" style={{ marginBottom: 10, color: "var(--error)" }}>
          KEY POLICIES · ZERO TOLERANCE
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {RULES.map((r) => (
            <div
              key={r.head}
              style={{
                display: "grid", gridTemplateColumns: "24px 1fr", gap: 12,
                padding: "10px 0", borderBottom: "1px solid var(--rule-soft)",
              }}
            >
              <span style={{ color: "var(--error)", fontSize: 18, lineHeight: 1 }}>●</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.head}</div>
                <div className="muted body-s" style={{ marginTop: 2 }}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const SCHED_CSS = `
  .sched-row {
    grid-template-columns: 130px 1fr 140px 140px !important;
    gap: 12px !important; padding: 8px 14px !important;
  }
  @media (max-width: 700px) {
    .sched-row { grid-template-columns: 110px 1fr !important; }
    .sched-row > :nth-child(n+3) { display: none; }
  }
`;
