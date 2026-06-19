import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import { adminStore, useSuperAuth } from "@/lib/auth-store";
import type { SuperAccountUpdate, SuperAdminProfile, SuperChangePassword } from "@crestly/shared";

export function AccountPage() {
  const { admin } = useSuperAuth();
  const [name, setName] = useState(admin?.name ?? "");
  const [phone, setPhone] = useState(admin?.phone ?? "");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const updateAcc = useMutation({
    mutationFn: async (body: SuperAccountUpdate) =>
      (await api.put<SuperAdminProfile>("/superadmin/auth/account", body)).data,
    onSuccess: (a) => { adminStore.setAdmin(a); setProfileMsg("Profile saved."); },
  });
  const changePw = useMutation({
    mutationFn: async (body: SuperChangePassword) =>
      (await api.post<{ ok: true }>("/superadmin/auth/change-password", body)).data,
  });

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileErr(null); setProfileMsg(null);
    try { await updateAcc.mutateAsync({ name, phone: phone || null }); }
    catch (e) { setProfileErr(getErrorMessage(e, "Save failed")); }
  }
  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null); setPwMsg(null);
    try { await changePw.mutateAsync({ currentPassword: cur, newPassword: next }); setCur(""); setNext(""); setPwMsg("Password updated."); }
    catch (e) { setPwErr(getErrorMessage(e, "Change failed")); }
  }

  return (
    <>
      <PageHead
        group="PLATFORM"
        title="Account"
        lede="Your profile + password."
      />

      <div className="grid grid--split grid--gap-lg">
        <form className="card" onSubmit={onSaveProfile}>
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Profile</div>
          {profileMsg && <div className="banner banner--success"><Icon name="check" size={14} /><span>{profileMsg}</span></div>}
          {profileErr && <div className="banner banner--error"><Icon name="alert" size={14} /><span>{profileErr}</span></div>}
          <div className="form-grid form-grid--2">
            <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Phone"><input className="input mono" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label="Email" fullWidth><input className="input" value={admin?.email ?? ""} disabled /></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button type="submit" className="btn btn--primary" disabled={updateAcc.isPending}>
              {updateAcc.isPending ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>

        <form className="card" onSubmit={onChangePassword}>
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Change password</div>
          {pwMsg && <div className="banner banner--success"><Icon name="check" size={14} /><span>{pwMsg}</span></div>}
          {pwErr && <div className="banner banner--error"><Icon name="alert" size={14} /><span>{pwErr}</span></div>}
          <div className="form-grid form-grid--1">
            <Field label="Current password"><input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
            <Field label="New password (8+ chars)"><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} /></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button type="submit" className="btn btn--primary" disabled={changePw.isPending}>
              {changePw.isPending ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, fullWidth, children }: { label: string; fullWidth?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field__label">{label}</label>
      {children}
    </div>
  );
}
