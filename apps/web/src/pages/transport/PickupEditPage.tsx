import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { useDeletePickup, usePickupPoint, useSavePickup } from "./hooks";
import { useTransportSlabs } from "@/pages/fee-structure/hooks";
import { getErrorMessage } from "@/lib/api";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function PickupEditPage() {
  const { id } = useParams<{ id: string }>();
  const pid = id ? Number(id) : undefined;
  const isNew = pid === undefined;
  const navigate = useNavigate();
  const { data: existing, isLoading } = usePickupPoint(pid);
  const save = useSavePickup(pid);
  const remove = useDeletePickup();
  const { data: slabs } = useTransportSlabs();

  const [name, setName] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [googleMapsLink, setGoogleMapsLink] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setDistanceKm(existing.distanceKm != null ? String(existing.distanceKm) : "");
      setLatitude(existing.latitude != null ? String(existing.latitude) : "");
      setLongitude(existing.longitude != null ? String(existing.longitude) : "");
      setGoogleMapsLink(existing.googleMapsLink ?? "");
    }
  }, [existing]);

  const km = Number(distanceKm);
  const previewSlab = !Number.isNaN(km) && slabs
    ? slabs.find((s) => km >= s.minKm && km <= s.maxKm)
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const saved = await save.mutateAsync({
        name,
        distanceKm: distanceKm.trim() === "" ? null : Number(distanceKm),
        latitude: latitude.trim() === "" ? null : Number(latitude),
        longitude: longitude.trim() === "" ? null : Number(longitude),
        googleMapsLink: googleMapsLink.trim() || null,
      });
      navigate(`/transport/${saved.id}`, { replace: true });
    } catch (e) { setErr(getErrorMessage(e, "Could not save")); }
  }

  async function onDelete() {
    if (!pid) return;
    if (!confirm("Delete this pickup point?")) return;
    try { await remove.mutateAsync(pid); navigate("/transport", { replace: true }); }
    catch (e) { setErr(getErrorMessage(e, "Failed")); }
  }

  if (!isNew && isLoading) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHead
        group="TRANSPORT"
        title={isNew ? "New pickup point" : `Edit · ${existing?.name ?? ""}`}
        actions={
          <Link to={isNew ? "/transport" : `/transport/${pid}`} className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <form className="card" onSubmit={onSubmit}>
        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">01</span><span className="form-section__title">Location</span></div>
          <div className="form-grid form-grid--2">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field__label">Name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="field__label">Distance from school (km)</label>
              <input className="input mono" inputMode="decimal" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
              {previewSlab && (
                <span className="field__hint">
                  Falls in slab <b>{previewSlab.slab}</b> → {fmt(previewSlab.yearlyFee)} / yr · {fmt(previewSlab.quarterlyFee)} / qtr · {fmt(previewSlab.monthlyFee)} / mo
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">02</span><span className="form-section__title">GPS coordinates</span></div>
          <div className="form-grid form-grid--2">
            <div className="field"><label className="field__label">Latitude</label><input className="input mono" value={latitude} onChange={(e) => setLatitude(e.target.value)} /></div>
            <div className="field"><label className="field__label">Longitude</label><input className="input mono" value={longitude} onChange={(e) => setLongitude(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field__label">Google Maps URL</label>
              <input className="input" value={googleMapsLink} onChange={(e) => setGoogleMapsLink(e.target.value)} />
            </div>
          </div>
        </div>

        {err && <div className="banner banner--error"><span>{err}</span></div>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <div>
            {!isNew && (
              <button type="button" className="btn btn--danger" onClick={onDelete}>
                Delete pickup
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : isNew ? "Create pickup" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
