import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api } from "@/lib/api";
import type { FeaturePurchaseRow } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

type Invoice = FeaturePurchaseRow & {
  school: { name: string; address: string | null; city: string | null; state: string | null };
};

export function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const invoiceId = Number(id);
  const { data, isLoading, error } = useQuery({
    queryKey: ["super", "invoice", invoiceId],
    enabled: !Number.isNaN(invoiceId),
    queryFn: async () => (await api.get<Invoice>(`/superadmin/ledger/invoice/${invoiceId}`)).data,
  });

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data) return <div className="banner banner--error"><span>Invoice not found.</span></div>;

  const isIntraState = (data.school.state ?? "").toLowerCase().includes("rajasthan");
  const subtotal = data.amount;
  const gst = data.gstAmount ?? 0;
  const total = data.totalAmount ?? subtotal + gst;
  const halfGst = Math.round(gst / 2);

  return (
    <>
      <PageHead
        group="REVENUE"
        meta={`INV ${data.invoiceNo ?? `#${data.id}`}`}
        title="Tax Invoice"
        actions={
          <>
            <Link to="/ledger" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Back
            </Link>
            <button className="btn btn--primary btn--sm" onClick={() => window.print()}>
              <Icon name="print" size={14} /> Print
            </button>
          </>
        }
      />

      <div className="card" style={{ position: "relative" }}>
        {data.status === "paid" && (
          <div style={{
            position: "absolute", top: 24, right: 24, padding: "6px 14px",
            border: "2px solid var(--success)", color: "var(--success)",
            borderRadius: 6, fontWeight: 700, fontFamily: "var(--font-mono)",
            letterSpacing: "0.2em", transform: "rotate(-12deg)",
          }}>PAID</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div>
            <div className="label" style={{ color: "var(--ink-40)" }}>FROM</div>
            <div className="display-s" style={{ fontSize: 18, marginTop: 4 }}>Crestly Platform</div>
            <p className="muted body-s" style={{ margin: 0 }}>
              Crestly Platform Pvt Ltd<br />
              Jaipur, Rajasthan, India
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="label" style={{ color: "var(--ink-40)" }}>BILLED TO</div>
            <div className="display-s" style={{ fontSize: 18, marginTop: 4 }}>{data.school.name}</div>
            <p className="muted body-s" style={{ margin: 0 }}>
              {data.school.address ?? "—"}
              {data.school.city && <><br />{data.school.city}{data.school.state ? `, ${data.school.state}` : ""}</>}
            </p>
          </div>
        </div>

        <div className="detail-list" style={{ marginBottom: 24 }}>
          <div className="detail-row"><div className="detail-row__k">Invoice no.</div><div className="detail-row__v mono">{data.invoiceNo ?? "—"}</div></div>
          <div className="detail-row"><div className="detail-row__k">Invoice date</div><div className="detail-row__v mono">{data.paidAt ? new Date(data.paidAt).toLocaleDateString("en-IN") : "—"}</div></div>
          <div className="detail-row"><div className="detail-row__k">Order ID</div><div className="detail-row__v mono">{data.orderId ?? "—"}</div></div>
          <div className="detail-row"><div className="detail-row__k">Payment ID</div><div className="detail-row__v mono">{data.paymentId ?? "—"}</div></div>
        </div>

        <table className="data-table" style={{ marginBottom: 16 }}>
          <thead><tr><th>Description</th><th>HSN/SAC</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            <tr>
              <td className="td-name">Crestly module · {data.featureKey}<div className="muted body-s">One-month subscription</div></td>
              <td className="mono">998314</td>
              <td className="mono" style={{ textAlign: "right" }}>{fmt(subtotal)}</td>
            </tr>
            <tr><td colSpan={2} style={{ textAlign: "right" }}>Subtotal</td><td className="mono" style={{ textAlign: "right" }}>{fmt(subtotal)}</td></tr>
            {gst > 0 && (
              isIntraState ? (
                <>
                  <tr><td colSpan={2} style={{ textAlign: "right" }}>CGST 9%</td><td className="mono" style={{ textAlign: "right" }}>{fmt(halfGst)}</td></tr>
                  <tr><td colSpan={2} style={{ textAlign: "right" }}>SGST 9%</td><td className="mono" style={{ textAlign: "right" }}>{fmt(gst - halfGst)}</td></tr>
                </>
              ) : (
                <tr><td colSpan={2} style={{ textAlign: "right" }}>IGST 18%</td><td className="mono" style={{ textAlign: "right" }}>{fmt(gst)}</td></tr>
              )
            )}
            <tr style={{ background: "var(--cream-soft)" }}>
              <td colSpan={2} style={{ textAlign: "right", fontWeight: 700 }}>Total</td>
              <td className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{fmt(total)}</td>
            </tr>
          </tbody>
        </table>

        <p className="muted body-s" style={{ marginBottom: 0 }}>
          This is a system-generated invoice. No signature required.
        </p>
      </div>
    </>
  );
}
