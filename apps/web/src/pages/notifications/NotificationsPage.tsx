import { useNavigate } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useMarkAllRead, useMarkRead, useNotifications } from "./hooks";
import type { AppNotification } from "@crestly/shared";

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const navigate = useNavigate();

  function onClick(n: AppNotification) {
    if (!n.readAt) markOne.mutate(n.id);
    if (n.linkUrl) {
      if (n.linkUrl.startsWith("http")) window.location.href = n.linkUrl;
      else navigate(n.linkUrl);
    }
  }

  return (
    <>
      <PageHead
        group="HR"
        title="Notifications"
        lede={data ? `${data.unread} unread of ${data.items.length}` : "Loading…"}
        actions={
          data && data.unread > 0 ? (
            <button className="btn btn--primary btn--sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <Icon name="check" size={14} /> Mark all read
            </button>
          ) : null
        }
      />

      {isLoading && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 16 }}><Skeleton.Text width="40%" /></div>
          <div style={{ padding: 16 }}><Skeleton.Text width="65%" /></div>
          <div style={{ padding: 16 }}><Skeleton.Text width="50%" /></div>
        </div>
      )}
      {!isLoading && data && data.items.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>ALL CAUGHT UP</div>
          <div className="muted body-s">You don't have any notifications right now.</div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {data?.items.map((n) => (
          <button
            key={n.id}
            onClick={() => onClick(n)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: 16,
              border: 0,
              background: n.readAt ? "transparent" : "var(--cream-soft)",
              borderBottom: "1px solid var(--rule-soft)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              {!n.readAt && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--orange)" }} />}
              <span className="pill pill--neutral mono" style={{ fontSize: 9 }}>{n.type}</span>
              <span className="muted mono" style={{ fontSize: 11, marginLeft: "auto" }}>
                {new Date(n.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <div style={{ fontWeight: 600 }}>{n.title}</div>
            {n.body && <div className="muted body-s" style={{ marginTop: 2 }}>{n.body}</div>}
          </button>
        ))}
      </div>
    </>
  );
}
