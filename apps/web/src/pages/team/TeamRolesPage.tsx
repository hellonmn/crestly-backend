import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { usePermissions, useRoles, useToggleRolePermission } from "./hooks";

/**
 * Roles & permissions matrix — mirrors erp/team/roles.php. Each role card
 * has a checkbox grid grouped by module. Toggling a checkbox auto-saves.
 */
export function TeamRolesPage() {
  const { data: roles } = useRoles();
  const { data: perms } = usePermissions();

  const byModule = useMemo(() => {
    const map = new Map<string, typeof perms>();
    for (const p of perms ?? []) {
      const arr = map.get(p.module) ?? [];
      arr.push(p);
      map.set(p.module, arr);
    }
    return Array.from(map.entries()).map(([mod, list]) => ({ module: mod, items: list ?? [] }));
  }, [perms]);

  return (
    <>
      <PageHead
        group="TEAM"
        title="Roles & Permissions"
        lede="Toggles auto-save. System roles cannot be deleted but their permissions can be changed."
        actions={
          <Link to="/team" className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back to team
          </Link>
        }
      />

      {(roles ?? []).map((role) => (
        <RoleCard key={role.id} role={role} byModule={byModule} />
      ))}
    </>
  );
}

function RoleCard({
  role,
  byModule,
}: {
  role: NonNullable<ReturnType<typeof useRoles>["data"]>[number];
  byModule: { module: string; items: NonNullable<ReturnType<typeof usePermissions>["data"]> }[];
}) {
  const toggle = useToggleRolePermission(role.slug);
  const has = (permKey: string) => role.permissions.includes(permKey);

  function onToggle(permKey: string, currentlyEnabled: boolean) {
    toggle.mutate({ permKey, enabled: !currentlyEnabled });
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div className="display-s">{role.name}</div>
        <span className="pill pill--neutral mono">{role.slug}</span>
        {role.isSystem && <span className="pill pill--wheat">SYSTEM</span>}
        <span className="muted" style={{ fontSize: 12 }}>
          · {role.memberCount} member{role.memberCount === 1 ? "" : "s"} · {role.permissions.length} permission{role.permissions.length === 1 ? "" : "s"}
        </span>
      </div>

      {byModule.map(({ module, items }) => (
        <div key={module} style={{ marginBottom: 16 }}>
          <div className="label" style={{ marginBottom: 8, color: "var(--ink-40)" }}>{module}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
            {items.map((p) => (
              <label key={p.id} className="check">
                <input
                  type="checkbox"
                  checked={has(p.permKey)}
                  onChange={() => onToggle(p.permKey, has(p.permKey))}
                />
                <span>
                  {p.label}
                  <span className="mono muted" style={{ marginLeft: 6, fontSize: 11 }}>{p.permKey}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
