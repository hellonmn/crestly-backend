import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useStudentDetail } from "./hooks";
import { useSendFeeReminder } from "@/pages/fee-ledger/hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import { useState } from "react";
import type { StudentDetail, StudentFeeBreakdown } from "@crestly/shared";

/* ============================================================
   Student detail page — ports erp/students/view.php verbatim.
   Left column: Personal + Parents & Contact + Hostel (boarders)
                OR Pickup (day scholars) + Sibling family.
   Right column (sticky): Fee summary + breakdown + installment.
   ============================================================ */

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}
function padSr(n: number): string { return String(n).padStart(4, "0"); }
function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function moneyCompact(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtPct(n: number): string {
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, "");
}
function phoneDigits(s: string | null): string {
  if (!s) return "";
  return s.replace(/\D+/g, "").replace(/^91/, "").slice(-10);
}
function phoneDisplay(s: string | null): string {
  const d = phoneDigits(s);
  if (d.length !== 10) return s ?? "—";
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

function statusPill(status: StudentDetail["status"]) {
  return status === "active"
    ? { cls: "pill--success", label: "Active" }
    : { cls: "pill--neutral", label: "Inactive" };
}
function feePill(fees: StudentFeeBreakdown | null) {
  if (!fees) return { cls: "pill--neutral", label: "No fee record" };
  switch (fees.paymentStatus) {
    case "paid":    return { cls: "pill--success", label: "Paid" };
    case "partial": return { cls: "pill--info",    label: "Partial" };
    case "overdue": return { cls: "pill--error",   label: "Overdue" };
    default:        return { cls: "pill--warn",    label: "Pending" };
  }
}

export function StudentViewPage() {
  const { srNumber } = useParams<{ srNumber: string }>();
  const sr = Number(srNumber);
  const { data, isLoading, error } = useStudentDetail(sr);
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("students.manage");

  if (isLoading) {
    return (
      <>
        <PageHead group="STUDENTS" title="Loading…" />
        <div className="card"><Skeleton.Title width="60%" /><Skeleton.Text width="40%" style={{ marginTop: 8 }} /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="STUDENTS" title="Not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>No student matches SR #{sr}. They may have been deleted or you may not have access.</span>
        </div>
        <Link to="/students" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to list
        </Link>
      </>
    );
  }

  const status = statusPill(data.status);
  const fee = feePill(data.fees);
  const callingPhone = phoneDigits(data.callingNumber ?? data.fatherContact ?? data.motherContact);
  const fatherPhone = phoneDigits(data.fatherContact);
  const motherPhone = phoneDigits(data.motherContact);
  const whatsappPhone = phoneDigits(data.whatsappNumber ?? data.callingNumber ?? data.fatherContact);

  const collectedPct = data.fees && data.fees.totalThisYear > 0
    ? Math.round((data.fees.paidAmount / data.fees.totalThisYear) * 1000) / 10
    : 0;

  return (
    <>
      <PageHead
        group="STUDENTS"
        meta={`SR ${padSr(data.srNumber)}`}
        title={data.studentName}
        lede={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="cls-pill">{data.class}-{data.section}</span>
            <span className={`pill ${status.cls}`}>
              <span className="pill__dot" />{status.label}
            </span>
            {data.age && <span className="muted body-s">{data.age} years</span>}
            {data.gender && <span className="muted body-s">· {data.gender}</span>}
            {data.familyId && (
              <span className="pill pill--neutral">SIBLING · #{data.familyId}</span>
            )}
            {data.isHostel && (
              <span className="pill pill--info">
                HOSTEL{data.hostel?.roomNo ? ` · ${data.hostel.roomNo}` : ""}
              </span>
            )}
            {data.fees && (
              <span className={`pill ${fee.cls}`}>
                <span className="pill__dot" />Fee {fee.label.toLowerCase()}
              </span>
            )}
          </div>
        }
        actions={
          <>
            <Link to="/students" className="btn btn--ghost btn--sm">← Back</Link>
            {whatsappPhone && (
              <a
                href={`https://wa.me/91${whatsappPhone}`}
                target="_blank"
                rel="noopener"
                className="btn btn--success btn--sm"
              >
                <WaIcon /> WhatsApp
              </a>
            )}
            {callingPhone && (
              <a href={`tel:+91${callingPhone}`} className="btn btn--ink btn--sm">
                <CallIcon /> Call
              </a>
            )}
            <Link to={`/attendance/student/${sr}`} className="btn btn--ghost btn--sm">
              <Icon name="calendar" size={14} /> Attendance
            </Link>
            {canManage && (
              <Link to={`/students/${sr}/edit`} className="btn btn--ghost btn--sm">
                <Icon name="edit" size={14} /> Edit
              </Link>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />

      <div className="grid grid--split-r grid--gap-lg" style={{ alignItems: "start" }}>

        {/* LEFT COLUMN — bio + parents + (hostel | pickup) + siblings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          <BioCard s={data} />
          <ParentsCard s={data} fatherPhone={fatherPhone} motherPhone={motherPhone} callingPhone={callingPhone} whatsappPhone={whatsappPhone} />
          {data.hostel && <HostelCard s={data} />}
          {!data.isHostel && <PickupCard s={data} />}
          {data.family && <SiblingsCard s={data} />}

        </div>

        {/* RIGHT COLUMN — fee summary, breakdown, installments (sticky) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 20 }}>
          {data.fees ? (
            <>
              <FeeSummaryCard fees={data.fees} sr={sr} collectedPct={collectedPct} feePillClass={fee.cls} feePillLabel={fee.label} />
              <FeeBreakdownCard fees={data.fees} />
              <InstallmentCard fees={data.fees} />
            </>
          ) : (
            <div className="banner banner--warn">
              <Icon name="alert" size={16} />
              <span>
                <b>No fee allotment</b> for the current session.{" "}
                <Link to="/fee-structure">Set up Fee Structure</Link> to generate one.
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{STU_VIEW_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function BioCard({ s }: { s: StudentDetail }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>PERSONAL</div>
      <div className="detail-list">
        <DRow k="SR Number" v={<span className="mono">{padSr(s.srNumber)}</span>} />
        <DRow k="Date of birth" v={fmtDate(s.dob)} />
        <DRow k="Age" v={s.age ? `${s.age} years` : "—"} />
        <DRow k="Gender" v={s.gender ?? "—"} />
        <DRow k="Class / Section" v={`${s.class} · ${s.section}`} />
        {s.stream && (
          <DRow k="Stream" v={`${s.stream}${s.subStream ? ` · ${s.subStream}` : ""}`} />
        )}
        <DRow k="Board" v={s.board ?? "—"} />
        {s.bloodGroup && (
          <DRow k="Blood group" v={<span className="pill pill--error" style={{ padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{s.bloodGroup}</span>} />
        )}
        <DRow k="Address" v={s.address ?? "—"} wide />
      </div>
    </div>
  );
}

function ParentsCard({
  s, fatherPhone, motherPhone, callingPhone, whatsappPhone,
}: {
  s: StudentDetail;
  fatherPhone: string;
  motherPhone: string;
  callingPhone: string;
  whatsappPhone: string;
}) {
  const lg = phoneDigits(s.localGuardianContact);
  const lgw = phoneDigits(s.localGuardianWhatsapp);
  const acad = phoneDigits(s.academicCallingNumber);
  const feep = phoneDigits(s.feeCallingNumber);

  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>PARENTS &amp; CONTACT</div>
      <div className="detail-list">
        <DRow k="Father" v={s.fatherName ?? "—"} />
        {fatherPhone && (
          <DRow
            k="Father · phone"
            kMuted
            v={
              <>
                {phoneDisplay(s.fatherContact)}
                <CallChip phone={fatherPhone} />
                <WaChip phone={fatherPhone} />
              </>
            }
          />
        )}
        <DRow k="Mother" v={s.motherName ?? "—"} />
        {motherPhone && (
          <DRow
            k="Mother · phone"
            kMuted
            v={
              <>
                {phoneDisplay(s.motherContact)}
                <CallChip phone={motherPhone} />
                <WaChip phone={motherPhone} />
              </>
            }
          />
        )}
        {callingPhone && callingPhone !== fatherPhone && callingPhone !== motherPhone && (
          <DRow
            k="Calling number"
            v={
              <>
                {phoneDisplay(s.callingNumber)}
                <CallChip phone={callingPhone} />
              </>
            }
          />
        )}
        {whatsappPhone && whatsappPhone !== fatherPhone && whatsappPhone !== motherPhone && (
          <DRow
            k="WhatsApp"
            v={
              <>
                {phoneDisplay(s.whatsappNumber)}
                <WaChip phone={whatsappPhone} label="Message" />
              </>
            }
          />
        )}

        {s.localGuardianName && (
          <>
            <DRow
              k="Local guardian"
              v={`${s.localGuardianName}${s.guardianRelation ? ` · ${s.guardianRelation}` : ""}`}
            />
            {lg && (
              <DRow
                k="Guardian · phone"
                kMuted
                v={
                  <>
                    {phoneDisplay(s.localGuardianContact)}
                    <CallChip phone={lg} />
                    {lgw && <WaChip phone={lgw} />}
                  </>
                }
              />
            )}
          </>
        )}

        {s.academicContactPerson && (
          <DRow
            k="Academic contact"
            v={
              <>
                {s.academicContactPerson}
                {acad && <CallChip phone={acad} />}
              </>
            }
          />
        )}
        {s.feeContactPerson && (
          <DRow
            k="Fee contact"
            v={
              <>
                {s.feeContactPerson}
                {feep && <CallChip phone={feep} />}
              </>
            }
          />
        )}
      </div>
    </div>
  );
}

function HostelCard({ s }: { s: StudentDetail }) {
  if (!s.hostel) return null;
  const h = s.hostel;
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>HOSTEL {h.block ? h.block.toUpperCase() : ""}</div>
      <div className="detail-list">
        {h.roomNo && (
          <DRow
            k="Room"
            v={
              <>
                <span className="mono">{h.roomNo}</span>
                {h.roomType && <> · {h.roomType} sharing</>}
                {h.floor && <> · {h.floor} floor</>}
              </>
            }
          />
        )}
        {h.roommates && <DRow k="Roommates" v={h.roommates} wide />}
        {h.bloodGroup && (
          <DRow k="Blood group" v={<span className="pill pill--error" style={{ padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{h.bloodGroup}</span>} />
        )}
        {(h.homeCity || h.homeState) && (
          <DRow k="Home city" v={[h.homeCity, h.homeState].filter(Boolean).join(", ")} />
        )}
        {h.homeAddress && <DRow k="Home address" v={h.homeAddress} wide />}
        {s.localGuardianName && (
          <DRow
            k="Local guardian"
            wide
            v={
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600 }}>{s.localGuardianName}</div>
                {s.localGuardianAddress && (
                  <div className="muted body-s" style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>{s.localGuardianAddress}</div>
                )}
                {s.localGuardianContact && (
                  <div style={{ marginTop: 6 }}>
                    <CallChip phone={phoneDigits(s.localGuardianContact)} />
                    {s.localGuardianWhatsapp && <WaChip phone={phoneDigits(s.localGuardianWhatsapp)} />}
                  </div>
                )}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}

function PickupCard({ s }: { s: StudentDetail }) {
  const hasGeo = s.pickupLatitude !== null && s.pickupLongitude !== null;
  const lat = s.pickupLatitude ?? 0;
  const lng = s.pickupLongitude ?? 0;
  const embed = hasGeo
    ? `https://maps.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=15&hl=en&output=embed`
    : null;
  const openLink = s.pickupMapsLink ?? (hasGeo ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : null);

  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>PICKUP &amp; TRANSPORT</div>
      <div className="detail-list">
        {s.pickupName ? (
          <>
            <DRow k="Pickup point" v={s.pickupName} />
            {s.pickupDistanceKm !== null && (
              <DRow k="Distance from school" v={`${s.pickupDistanceKm.toFixed(2)} km`} />
            )}
            {hasGeo && (
              <DRow k="GPS" v={<span className="mono">{lat.toFixed(5)}, {lng.toFixed(5)}</span>} />
            )}
            {s.fees?.transportSlab && (
              <DRow
                k="Transport slab"
                v={`${s.fees.transportSlab} · ${moneyCompact(s.fees.transportFee)}/year`}
              />
            )}
          </>
        ) : (
          <DRow k="Pickup" v={<span className="muted">Self pickup</span>} />
        )}
      </div>

      {embed && (
        <>
          <div style={{ marginTop: 12, border: "1px solid var(--rule)", borderRadius: "var(--r-3)", overflow: "hidden" }}>
            <iframe
              src={embed}
              title="Pickup location map"
              width="100%"
              height={220}
              style={{ border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          {openLink && (
            <div style={{ marginTop: 8, textAlign: "right" }}>
              <a href={openLink} target="_blank" rel="noopener" className="chip" style={{ padding: "3px 10px" }}>
                Open larger map →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SiblingsCard({ s }: { s: StudentDetail }) {
  if (!s.family) return null;
  const f = s.family;
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>SIBLING FAMILY · #{f.familyId}</div>
      <div className="detail-list">
        <DRow k="Family head" v={f.fatherName ?? "—"} />
        <DRow k="Total siblings" v={String(f.siblingCount)} />
        {s.fees && s.fees.siblingDiscountPct > 0 && (
          <DRow
            k="Sibling discount applied"
            v={
              <>
                {fmtPct(s.fees.siblingDiscountPct)}%
                {s.fees.siblingPosition && <span className="muted body-s"> · {s.fees.siblingPosition}</span>}
              </>
            }
          />
        )}
      </div>
      {s.siblings.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {s.siblings.map((sib) => (
            <Link key={sib.srNumber} to={`/students/${sib.srNumber}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div className="sibling-row">
                <div className="avatar avatar--cream avatar--sm" style={{ width: 32, height: 32, fontSize: 13 }}>
                  {initials(sib.studentName)}
                </div>
                <div style={{ fontWeight: 600 }}>{sib.studentName}</div>
                <span className="cls-pill">{sib.class}-{sib.section}</span>
                <span className="muted body-s">SR #{padSr(sib.srNumber)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FeeSummaryCard({
  fees, sr, collectedPct, feePillClass, feePillLabel,
}: {
  fees: StudentFeeBreakdown;
  sr: number;
  collectedPct: number;
  feePillClass: string;
  feePillLabel: string;
}) {
  const reminder = useSendFeeReminder(sr);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSendReminder() {
    setFlash(null);
    try {
      const r = await reminder.mutateAsync();
      setFlash({ ok: true, msg: `WhatsApp reminder queued for ₹${r.due.toLocaleString("en-IN")}.` });
    } catch (e) {
      setFlash({ ok: false, msg: getErrorMessage(e, "Couldn't send reminder") });
    }
    setTimeout(() => setFlash(null), 4000);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <div className="label">FEE · SESSION {fees.sessionCode}</div>
          <div className="display-m" style={{ marginTop: 6 }}>{moneyCompact(fees.totalThisYear)}<BrandDot /></div>
          <div className="muted body-s" style={{ marginTop: 4 }}>
            {fees.admissionStatus}
            {fees.siblingDiscountPct > 0 && <> · {fmtPct(fees.siblingDiscountPct)}% sibling off</>}
          </div>
        </div>
        <span className={`pill ${feePillClass}`}><span className="pill__dot" />{feePillLabel}</span>
      </div>

      <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${collectedPct}%`, background: "var(--orange)", borderRadius: "var(--r-pill)" }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div>
          <div className="label">COLLECTED</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginTop: 2 }}>{money(fees.paidAmount)}</div>
        </div>
        <div>
          <div className="label">DUE</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginTop: 2, color: "var(--error)" }}>{money(fees.dueAmount)}</div>
        </div>
        <div>
          <div className="label">PROGRESS</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginTop: 2 }}>{collectedPct.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Link to={`/fee-ledger/student/${sr}`} className="btn btn--success btn--sm">Record payment</Link>
        <Link to={`/fee-ledger?q=${sr}`} className="btn btn--ghost btn--sm">Open ledger →</Link>
        {fees.dueAmount > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onSendReminder}
            disabled={reminder.isPending}
            title="Sends the fee.reminder WhatsApp template to the parent"
          >
            <Icon name="msg" size={14} />
            {" "}{reminder.isPending ? "Sending…" : "WhatsApp reminder"}
          </button>
        )}
      </div>

      {flash && (
        <div
          className={`banner banner--${flash.ok ? "success" : "error"}`}
          style={{ marginTop: 12 }}
        >
          <Icon name={flash.ok ? "check" : "alert"} size={14} /><span>{flash.msg}</span>
        </div>
      )}
    </div>
  );
}

const HOSTEL_COMMON_PARTS: { label: string; amt: number }[] = [
  { label: "Mess / boarding (4 meals/day)", amt: 70000 },
  { label: "Laundry",                        amt: 7000 },
  { label: "Activity & care",                amt: 8000 },
  { label: "Medical",                        amt: 3000 },
  { label: "Security & maintenance",         amt: 5000 },
];
const HOSTEL_COMMON_KNOWN = HOSTEL_COMMON_PARTS.reduce((s, p) => s + p.amt, 0);

function FeeBreakdownCard({ fees }: { fees: StudentFeeBreakdown }) {
  const isHostel = fees.isHostel;
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>FEE BREAKDOWN · {fees.sessionCode}</div>
      <div className="detail-list">
        <DRow k="Tuition (original)" v={money(fees.tuitionOriginal)} />
        {fees.tuitionDiscount > 0 && (
          <DRow
            k={<span className="muted">– Sibling discount</span>}
            v={<span style={{ color: "var(--success)" }}>– {money(fees.tuitionDiscount)}</span>}
          />
        )}
        <DRow k="Tuition payable" v={<b>{money(fees.tuitionPayable)}</b>} />
        <DRow k="Annual charges" v={money(fees.annualCharges)} />
        <DRow k="Activity fee" v={money(fees.activityFee)} />
        <DRow k="Exam fee" v={money(fees.examFee)} />

        {isHostel && (
          <>
            <DRow
              k={
                <>
                  Hostel lodging{fees.roomType ? ` · ${fees.roomType}` : ""}
                  {fees.lodgingDiscountPct > 0 && (
                    <span className="muted body-s" style={{ fontSize: 10, letterSpacing: 0, textTransform: "none", marginLeft: 4 }}>
                      (after {fmtPct(fees.lodgingDiscountPct)}% sibling)
                    </span>
                  )}
                </>
              }
              v={money(fees.hostelLodging)}
            />
            {fees.hostelMess > 0 && (
              <DRow
                k={
                  <>
                    Hostel mess{" "}
                    <span className="muted body-s" style={{ fontSize: 10, letterSpacing: 0, textTransform: "none", marginLeft: 4 }}>
                      (4 meals/day)
                    </span>
                  </>
                }
                v={money(fees.hostelMess)}
              />
            )}
            <DRow k="Hostel common" v={money(fees.hostelCommon)} />
            {fees.hostelCommon === HOSTEL_COMMON_KNOWN && HOSTEL_COMMON_PARTS.map((p) => (
              <DRow
                key={p.label}
                k={<span className="muted body-s" style={{ paddingLeft: 14 }}>↳ {p.label}</span>}
                v={<span className="muted">{money(p.amt)}</span>}
              />
            ))}
          </>
        )}

        {!isHostel && fees.transportFee > 0 && (
          <DRow k={`Transport · ${fees.transportSlab ?? ""}`} v={money(fees.transportFee)} />
        )}

        <DRow
          k={<b style={{ color: "var(--ink)" }}>Yearly recurring</b>}
          v={<b>{money(fees.yearlyRecurringTotal)}</b>}
          rowStyle={{ background: "var(--cream-soft)" }}
        />

        {fees.firstYearExtras > 0 && (
          <>
            {isHostel ? (
              <>
                {fees.hostelOneTime > 0 && (
                  <>
                    <DRow k="Hostel one-time" v={money(fees.hostelOneTime)} />
                    <DRow k={<span className="muted body-s" style={{ paddingLeft: 14 }}>↳ Admission fee</span>}
                          v={<span className="muted">₹15,000</span>} />
                    <DRow k={<span className="muted body-s" style={{ paddingLeft: 14 }}>↳ Caution money (refundable)</span>}
                          v={<span className="muted">₹20,000</span>} />
                  </>
                )}
                {fees.firstYearExtras - fees.hostelOneTime > 0 && (
                  <DRow k="School one-time" v={money(fees.firstYearExtras - fees.hostelOneTime)} />
                )}
              </>
            ) : (
              <>
                <DRow k="Registration fee" v={money(fees.registrationFee)} />
                <DRow k="Admission fee" v={money(fees.admissionFee)} />
                <DRow k="Caution money (refundable)" v={money(fees.cautionMoney)} />
              </>
            )}
            <DRow
              k={<b style={{ color: "var(--ink)" }}>First-year extras</b>}
              v={<b>{money(fees.firstYearExtras)}</b>}
              rowStyle={{ background: "var(--cream-soft)" }}
            />
          </>
        )}

        <DRow
          k={<b style={{ color: "var(--cream)" }}>Total this year</b>}
          v={
            <b style={{ color: "var(--cream)", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>
              {money(fees.totalThisYear)}
            </b>
          }
          rowStyle={{ background: "var(--ink)" }}
        />
      </div>
    </div>
  );
}

function InstallmentCard({ fees }: { fees: StudentFeeBreakdown }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 10 }}>INSTALLMENT OPTIONS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="stat-tile">
          <div className="stat-tile__icon icon-tint-wheat">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="16" rx="1.5"/>
              <path d="M3 10h18M8 3v4M16 3v4"/>
            </svg>
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__label">Quarterly</div>
            <div className="stat-tile__value" style={{ fontSize: 20 }}>{money(fees.quarterlyInstallment)}</div>
            <div className="stat-tile__delta">× 4 quarters (recurring)</div>
          </div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile__icon icon-tint-mint">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <div className="stat-tile__body">
            <div className="stat-tile__label">Monthly EMI</div>
            <div className="stat-tile__value" style={{ fontSize: 20 }}>{money(fees.monthlyEmi)}</div>
            <div className="stat-tile__delta">× 10 months (Apr–Jan)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function DRow({
  k, v, kMuted, wide, rowStyle,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  kMuted?: boolean;
  wide?: boolean;
  rowStyle?: React.CSSProperties;
}) {
  return (
    <div className="detail-row" style={{ ...(wide ? { gridTemplateColumns: "120px 1fr" } : {}), ...rowStyle }}>
      <span className={`detail-row__k ${kMuted ? "muted body-s" : ""}`}>{k}</span>
      <span className={`detail-row__v ${wide ? "" : ""}`} style={wide ? { fontSize: 13, color: "var(--ink)", textAlign: "right", lineHeight: 1.5 } : undefined}>
        {v}
      </span>
    </div>
  );
}

function CallChip({ phone }: { phone: string }) {
  if (!phone) return null;
  return (
    <a href={`tel:+91${phone}`} className="chip" style={{ padding: "3px 8px", fontSize: 11, marginLeft: 4 }}>
      Call
    </a>
  );
}

function WaChip({ phone, label = "WhatsApp" }: { phone: string; label?: string }) {
  if (!phone) return null;
  return (
    <a
      href={`https://wa.me/91${phone}`}
      target="_blank"
      rel="noopener"
      className="chip"
      style={{ padding: "3px 8px", fontSize: 11, marginLeft: 4, background: "#dcf8c6", color: "#075e54", borderColor: "#a3d999" }}
    >
      {label}
    </a>
  );
}

function CallIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}
function WaIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <path d="M21 12c0 4-4 7-9 7-1.4 0-2.7-.2-3.9-.6L3 20l1.3-4C3.5 14.9 3 13.5 3 12c0-4 4-7 9-7s9 3 9 7z"/>
    </svg>
  );
}

const STU_VIEW_CSS = `
  .sibling-row {
    display: grid;
    grid-template-columns: 36px 1fr auto auto;
    gap: 12px;
    align-items: center;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    padding: 10px 14px;
    transition: background 120ms ease;
  }
  .sibling-row:hover { background: var(--cream-soft); }
`;
