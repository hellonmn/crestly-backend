import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { useTeamMember } from "./hooks";
import { useAuth } from "@/lib/auth-store";

export function TeamViewPage() {
  const { id } = useParams<{ id: string }>();
  const userId = Number(id);
  const { data, isLoading, error } = useTeamMember(userId);
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("team.manage");

  if (isLoading) return <p className="muted">Loading…</p>;
  if (error || !data)
    return (
      <div className="banner banner--error">
        <span>Team member not found</span>
      </div>
    );

  return (
    <>
      <PageHead
        group="TEAM"
        meta={`User #${data.id}`}
        title={data.name}
        lede={[data.designation, data.department].filter(Boolean).join(" · ") || "—"}
        actions={
          <>
            <Link to="/team" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Back
            </Link>
            {data.phone && (
              <a href={`tel:+91${data.phone}`} className="btn btn--ghost btn--sm">
                <Icon name="msg" size={14} /> Call
              </a>
            )}
            {canManage && (
              <Link to={`/team/${data.id}/edit`} className="btn btn--primary btn--sm">
                <Icon name="edit" size={14} /> Edit
              </Link>
            )}
          </>
        }
      />

      <div className="grid grid--split grid--gap-lg">
        <div className="card">
          <div className="display-s" style={{ marginBottom: 16 }}>Employment</div>
          <div className="detail-list">
            <Row label="Employee ID" value={data.employeeId} />
            <Row label="Designation" value={data.designation} />
            <Row label="Department" value={data.department} />
            <Row label="Role" value={data.roleName} />
            <Row label="Class teacher of" value={data.classTeacherOf} />
            <Row label="Reports to" value={data.reportsTo} />
            <Row label="Employment type" value={data.employmentType} />
            <Row label="Date of joining" value={data.dateOfJoining} />
            <Row label="Experience" value={data.experienceYears != null ? `${data.experienceYears} years` : null} />
            <Row label="Qualification" value={data.qualification} />
            <Row label="Monthly salary" value={data.monthlySalary != null ? `₹${data.monthlySalary.toLocaleString("en-IN")}` : null} />
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 16 }}>Contact</div>
          <div className="detail-list">
            <Row label="Mobile" value={data.phone} />
            <Row label="WhatsApp" value={data.whatsapp} />
            <Row label="Emergency" value={data.emergencyContact} />
            <Row label="Email" value={data.email} />
            <Row label="Address" value={data.address} />
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 16 }}>Personal</div>
          <div className="detail-list">
            <Row label="Date of birth" value={data.dob} />
            <Row label="Gender" value={data.gender} />
            <Row label="Blood group" value={data.bloodGroup} />
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 16 }}>Access</div>
          <div className="detail-list">
            <Row label="Status" value={data.status} />
            <Row label="Last login" value={data.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString("en-IN") : null} />
            <Row label="Role" value={data.roleName} />
            <Row label="Role slug" value={data.roleSlug} />
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="detail-row">
      <div className="detail-row__k">{label}</div>
      <div className="detail-row__v">{value ?? <span className="muted">—</span>}</div>
    </div>
  );
}
