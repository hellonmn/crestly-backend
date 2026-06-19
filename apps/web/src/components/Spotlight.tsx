import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon, type IconName } from "@crestly/icons";
import { api } from "@/lib/api";
import type { SearchHit, SearchHitKind, SearchResponse } from "@crestly/shared";

/* ============================================================
   Cmd+K / Ctrl+K global spotlight search.
   Mounted once at the AppShell level. Searches Students, Team,
   Families, Admissions, Vouchers, Receipts, Pickup points, and
   a hard-coded Pages index for navigation jumps.
   ============================================================ */

// ────────────────────────────────────────────────────────────
// Static page index — typed at the top so users can jump to a
// page even before they know its URL.
// ────────────────────────────────────────────────────────────

interface PageEntry {
  title: string;
  href: string;
  group: string;
  /** Extra search terms beyond the title — synonyms / aliases. */
  keywords?: string;
}

const PAGE_INDEX: PageEntry[] = [
  { title: "Dashboard",          href: "/",                        group: "Pages", keywords: "home overview" },
  // Students
  { title: "Students",           href: "/students",                group: "Pages" },
  { title: "Add a student",      href: "/students/new",            group: "Pages", keywords: "create admission roll" },
  // Attendance
  { title: "Mark attendance",    href: "/attendance",              group: "Pages", keywords: "present absent roll-call" },
  { title: "Staff attendance",   href: "/staff-attendance",        group: "Pages", keywords: "punch in out geofence" },
  { title: "Punch in / out",     href: "/punch",                   group: "Pages", keywords: "punch attendance selfie" },
  // Fees
  { title: "Fee ledger",         href: "/fee-ledger",              group: "Pages", keywords: "payments dues collection" },
  { title: "Receipts",           href: "/fee-ledger/receipts",     group: "Pages", keywords: "fee print receipt" },
  { title: "Fee structure",      href: "/fee-structure",           group: "Pages", keywords: "tuition slab fees setup" },
  // Exams
  { title: "Exam terms",         href: "/exams/terms",             group: "Pages", keywords: "exam test period pt1 hy annual" },
  { title: "Exam subjects",      href: "/exams/subjects",          group: "Pages" },
  { title: "Date sheet",         href: "/exams/datesheet",         group: "Pages", keywords: "exam schedule timetable" },
  { title: "Marks entry",        href: "/exams/marks",             group: "Pages", keywords: "marks score grade" },
  { title: "Results",            href: "/exams/results",           group: "Pages", keywords: "rank grade percentage marksheet" },
  { title: "Co-Scholastic",      href: "/exams/co-scholastic",     group: "Pages" },
  // Records
  { title: "Classes & sections", href: "/classes",                 group: "Pages", keywords: "section teacher capacity" },
  { title: "Team",               href: "/team",                    group: "Pages", keywords: "staff users employees" },
  { title: "Roles & permissions", href: "/team/roles",             group: "Pages" },
  { title: "Families",           href: "/families",                group: "Pages", keywords: "siblings parent" },
  { title: "Holidays",           href: "/holidays",                group: "Pages", keywords: "calendar leave" },
  { title: "Transport",          href: "/transport",               group: "Pages", keywords: "pickup bus route" },
  { title: "Pickup slabs",       href: "/transport/slabs",         group: "Pages", keywords: "transport fee distance" },
  // Operations
  { title: "Timetable",          href: "/timetable",               group: "Pages" },
  { title: "Workload",           href: "/timetable/workload",      group: "Pages", keywords: "teacher load periods" },
  { title: "Daily report",       href: "/daily-report",            group: "Pages" },
  { title: "Notifications",      href: "/notifications",           group: "Pages" },
  { title: "Diary",              href: "/diary",                   group: "Pages", keywords: "homework classwork" },
  // Finance & HR
  { title: "Vouchers",           href: "/vouchers",                group: "Pages", keywords: "expense payment approval" },
  { title: "New voucher",        href: "/vouchers/new",            group: "Pages" },
  { title: "Ledger",             href: "/ledger",                  group: "Pages", keywords: "income expense pnl" },
  { title: "Staff salary",       href: "/ledger/staff",            group: "Pages", keywords: "salary payroll" },
  { title: "HR dashboard",       href: "/hr",                      group: "Pages" },
  { title: "Salary",             href: "/salary",                  group: "Pages" },
  { title: "Leaves",             href: "/leaves",                  group: "Pages" },
  { title: "Apply for leave",    href: "/leaves/apply",            group: "Pages" },
  { title: "Shifts / duty hours", href: "/shifts",                 group: "Pages" },
  // Admissions
  { title: "Admission enquiries", href: "/admissions",             group: "Pages", keywords: "admission enquiry lead" },
  { title: "New enquiry",        href: "/admissions/new",          group: "Pages" },
  { title: "Approvals",          href: "/approvals",               group: "Pages", keywords: "edit request review" },
  { title: "Promotion",          href: "/promotion",               group: "Pages", keywords: "promote next class" },
  { title: "Import",             href: "/import",                  group: "Pages", keywords: "csv upload bulk" },
  { title: "Review history",     href: "/review-history",          group: "Pages" },
  // Hostel
  { title: "Hostel",             href: "/hostel",                  group: "Pages", keywords: "boarder dorm" },
  { title: "Hostel rooms",       href: "/hostel/rooms",            group: "Pages" },
  { title: "Hostel boarders",    href: "/hostel/boarders",         group: "Pages" },
  { title: "Hostel fees",        href: "/hostel/fees",             group: "Pages" },
  { title: "Hostel schedule",    href: "/hostel/schedule",         group: "Pages" },
  // Settings
  { title: "Settings",           href: "/settings",                group: "Pages", keywords: "school info config" },
  { title: "Sessions",           href: "/sessions",                group: "Pages", keywords: "academic year session" },
  { title: "WhatsApp settings",  href: "/settings/whatsapp",       group: "Pages", keywords: "whatsapp cloud api meta" },
  { title: "WhatsApp templates", href: "/settings/whatsapp/templates", group: "Pages", keywords: "whatsapp binding action" },
  { title: "WhatsApp log",       href: "/settings/whatsapp/log",   group: "Pages", keywords: "whatsapp sent failed message" },
  { title: "Payment gateway",    href: "/settings/payment-gateway", group: "Pages", keywords: "hdfc razorpay checkout" },
  { title: "AI assistant",       href: "/settings/ai",             group: "Pages", keywords: "ai chat groq llm assistant" },
  { title: "Features",           href: "/features",                group: "Pages", keywords: "addon plugin unlock" },
];

function matchPages(q: string, limit: number): SearchHit[] {
  const ql = q.toLowerCase();
  return PAGE_INDEX
    .filter((p) =>
      p.title.toLowerCase().includes(ql) ||
      (p.keywords ?? "").toLowerCase().includes(ql),
    )
    .slice(0, limit)
    .map((p) => ({
      kind: "page" as const,
      key: `page-${p.href}`,
      title: p.title,
      subtitle: p.group,
      href: p.href,
      meta: null,
    }));
}

// ────────────────────────────────────────────────────────────
// Recently-opened ring
// ────────────────────────────────────────────────────────────

const RECENT_KEY = "crestly.spotlight.recent";
const RECENT_MAX = 8;

function loadRecent(): SearchHit[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchHit[];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function pushRecent(hit: SearchHit) {
  try {
    const cur = loadRecent().filter((h) => h.key !== hit.key);
    const next = [hit, ...cur].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* localStorage disabled — fail silently. */
  }
}

// ────────────────────────────────────────────────────────────
// Icon + label per result kind
// ────────────────────────────────────────────────────────────

const KIND_ICON: Record<SearchHitKind, IconName> = {
  student:   "students",
  team:      "team",
  family:    "users",
  voucher:   "ledger",
  receipt:   "rupee",
  admission: "admissions",
  pickup:    "transport",
  page:      "features",
};

const KIND_LABEL: Record<SearchHitKind, string> = {
  student: "Student", team: "Team", family: "Family",
  voucher: "Voucher", receipt: "Receipt", admission: "Admission",
  pickup: "Pickup point", page: "Page",
};

// ────────────────────────────────────────────────────────────
// Spotlight component
// ────────────────────────────────────────────────────────────

export function Spotlight() {
  const [open, setOpen]     = useState(false);
  const [q, setQ]           = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<SearchHit[]>(() => loadRecent());

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K toggle. Also Esc to close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset state on close; focus the input on open.
  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setActiveIdx(0);
      // Tiny delay to outwait the modal CSS transition.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      setQ("");
      setDebounced("");
    }
  }, [open]);

  // 250ms debounce on the actual API call.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // Backend fan-out — disabled when q is empty (we show recents instead).
  const { data, isFetching } = useQuery({
    queryKey: ["spotlight", debounced],
    enabled: debounced.length > 0,
    queryFn: async () =>
      (await api.get<SearchResponse>("/search", { params: { q: debounced, limit: 6 } })).data,
    staleTime: 30_000,
  });

  // Page matches are computed client-side (no API call needed).
  const pageHits = useMemo(() => (debounced ? matchPages(debounced, 6) : []), [debounced]);

  // Flatten groups into a single list for keyboard nav.
  const flat: { hit: SearchHit; groupLabel: string }[] = useMemo(() => {
    if (!debounced) {
      // Show recents when search is empty.
      return recent.map((h) => ({ hit: h, groupLabel: "Recent" }));
    }
    const out: { hit: SearchHit; groupLabel: string }[] = [];
    for (const g of data?.groups ?? []) {
      for (const h of g.hits) out.push({ hit: h, groupLabel: g.label });
    }
    for (const p of pageHits) out.push({ hit: p, groupLabel: "Pages" });
    return out;
  }, [debounced, data, pageHits, recent]);

  // Clamp activeIdx whenever the list shrinks.
  useEffect(() => {
    if (activeIdx >= flat.length) setActiveIdx(Math.max(0, flat.length - 1));
  }, [flat, activeIdx]);

  // ↑↓ + Enter
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const sel = flat[activeIdx];
        if (sel) go(sel.hit);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, activeIdx]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll the active item into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  function go(hit: SearchHit) {
    pushRecent(hit);
    navigate(hit.href);
    setOpen(false);
  }

  // Group flat list back into sections in render order.
  const sections = useMemo(() => {
    if (flat.length === 0) return [];
    const groups: { label: string; items: { hit: SearchHit; globalIdx: number }[]; viewAllHref?: string | null }[] = [];
    flat.forEach((entry, idx) => {
      const last = groups[groups.length - 1];
      if (last && last.label === entry.groupLabel) {
        last.items.push({ hit: entry.hit, globalIdx: idx });
      } else {
        groups.push({ label: entry.groupLabel, items: [{ hit: entry.hit, globalIdx: idx }] });
      }
    });
    // Attach viewAllHref from the API response groups.
    for (const g of groups) {
      const api = data?.groups.find((dg) => dg.label === g.label);
      g.viewAllHref = api?.viewAllHref ?? null;
    }
    return groups;
  }, [flat, data]);

  if (!open) return <>{null}<style>{TRIGGER_HINT_CSS}</style></>;

  return (
    <>
      <div className="spotlight-scrim" onClick={() => setOpen(false)} />
      <div className="spotlight" role="dialog" aria-modal="true" aria-label="Search">
        <div className="spotlight__head">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setActiveIdx(0); }}
            placeholder="Search students, team, vouchers, pages…"
            className="spotlight__input"
            autoComplete="off"
            spellCheck={false}
          />
          {isFetching && <span className="spotlight__spinner" aria-hidden="true" />}
          <button
            type="button"
            className="spotlight__close"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="spotlight__body" ref={listRef}>
          {!debounced && recent.length === 0 ? (
            <div className="spotlight__hint">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Search anything in Crestly</div>
              <div className="muted body-s">
                Try a student name, SR number, voucher number, or a page like
                "marks entry" or "whatsapp templates". Press <kbd>↑</kbd> <kbd>↓</kbd> to
                move, <kbd>↵</kbd> to open.
              </div>
            </div>
          ) : flat.length === 0 ? (
            <div className="spotlight__hint">
              <div className="muted body-s">No matches for "<b>{debounced}</b>".</div>
            </div>
          ) : (
            sections.map((g) => (
              <div key={g.label} className="spotlight__group">
                <div className="spotlight__group-head">
                  <span>{g.label}</span>
                  {g.viewAllHref && (
                    <button
                      type="button"
                      className="spotlight__view-all"
                      onClick={() => { navigate(g.viewAllHref!); setOpen(false); }}
                    >
                      View all →
                    </button>
                  )}
                </div>
                {g.items.map(({ hit, globalIdx }) => (
                  <button
                    key={hit.key}
                    data-idx={globalIdx}
                    type="button"
                    className={`spotlight__item ${activeIdx === globalIdx ? "is-active" : ""}`}
                    onClick={() => go(hit)}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                  >
                    <span className="spotlight__icon">
                      <Icon name={KIND_ICON[hit.kind]} size={15} />
                    </span>
                    <span className="spotlight__text">
                      <span className="spotlight__title">{hit.title}</span>
                      {hit.subtitle && (
                        <span className="spotlight__sub">{hit.subtitle}</span>
                      )}
                    </span>
                    {hit.meta && (
                      <span className="spotlight__meta">{hit.meta}</span>
                    )}
                    <span className="spotlight__kind">{KIND_LABEL[hit.kind]}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="spotlight__foot">
          <span className="kbd-row">
            <kbd>↑</kbd> <kbd>↓</kbd> navigate
          </span>
          <span className="kbd-row">
            <kbd>↵</kbd> open
          </span>
          <span className="kbd-row">
            <kbd>Esc</kbd> close
          </span>
          <span style={{ flex: 1 }} />
          {debounced && data && (
            <span className="muted body-s">
              {data.total} result{data.total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <style>{SPOTLIGHT_CSS}</style>
      <style>{TRIGGER_HINT_CSS}</style>
    </>
  );
}

/* ============================================================
   Topbar trigger button — render alongside the search shortcut
   hint. Exposed separately so the AppShell can place it in the
   header.
   ============================================================ */
export function SpotlightTriggerHint({ onOpen }: { onOpen: () => void }) {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      className="spotlight-trigger"
      onClick={onOpen}
      aria-label="Open search"
    >
      <Icon name="search" size={14} />
      <span className="spotlight-trigger__label">Search</span>
      <span className="spotlight-trigger__kbd">
        <kbd>{isMac ? "⌘" : "Ctrl"}</kbd>
        <kbd>K</kbd>
      </span>
    </button>
  );
}

/* ============================================================
   Hook for any page that wants to programmatically open the
   spotlight (e.g. a FAB or empty-state CTA).
   ============================================================ */
export function useOpenSpotlight() {
  return () => {
    // Reuse the global Cmd+K listener via a synthetic event so we don't
    // have to wire context just for this.
    const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    window.dispatchEvent(ev);
  };
}

/* ============================================================
   Styles
   ============================================================ */

const SPOTLIGHT_CSS = `
  .spotlight-scrim {
    position: fixed;
    inset: 0;
    background: rgba(16, 13, 10, 0.45);
    backdrop-filter: blur(2px);
    z-index: 1000;
    animation: spotlight-scrim-in 120ms ease;
  }
  @keyframes spotlight-scrim-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .spotlight {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 32px));
    max-height: 70vh;
    background: var(--cream-soft);
    border: 1px solid var(--rule-strong);
    border-radius: 14px;
    box-shadow: 0 30px 80px rgba(16,13,10,0.35), 0 6px 18px rgba(16,13,10,0.15);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: spotlight-in 140ms cubic-bezier(.2,.9,.3,1.1);
  }
  @keyframes spotlight-in {
    from { opacity: 0; transform: translate(-50%, -8px) scale(0.98); }
    to   { opacity: 1; transform: translate(-50%, 0)   scale(1); }
  }
  .spotlight__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--rule);
    background: var(--white);
  }
  .spotlight__input {
    flex: 1;
    border: 0;
    background: transparent;
    font-size: 17px;
    color: var(--ink);
    outline: none;
    font-family: inherit;
  }
  .spotlight__input::placeholder { color: var(--ink-40); }
  .spotlight__spinner {
    width: 14px; height: 14px;
    border: 2px solid var(--rule);
    border-top-color: var(--orange);
    border-radius: 50%;
    animation: spotlight-spin 0.6s linear infinite;
  }
  @keyframes spotlight-spin { to { transform: rotate(360deg); } }
  .spotlight__close {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    border: 0; background: transparent;
    border-radius: 6px;
    color: var(--ink-60);
    cursor: pointer;
  }
  .spotlight__close:hover { background: var(--cream); color: var(--ink); }

  .spotlight__body {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .spotlight__hint {
    padding: 24px 18px;
    text-align: left;
  }
  .spotlight__hint kbd {
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 0 5px;
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .spotlight__group { margin-bottom: 4px; }
  .spotlight__group-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px 4px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ink-40);
  }
  .spotlight__view-all {
    background: transparent;
    border: 0;
    cursor: pointer;
    font: inherit;
    font-size: 10.5px;
    color: var(--orange-deep);
    text-decoration: none;
    padding: 0;
  }
  .spotlight__view-all:hover { text-decoration: underline; }

  .spotlight__item {
    display: grid;
    grid-template-columns: 28px 1fr auto auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 9px 12px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    color: var(--ink);
    transition: background 80ms ease;
  }
  .spotlight__item.is-active {
    background: var(--white);
    box-shadow: 0 0 0 1px var(--orange) inset;
  }
  .spotlight__icon {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px;
    border-radius: 6px;
    background: var(--cream);
    color: var(--ink-60);
  }
  .spotlight__item.is-active .spotlight__icon {
    background: var(--orange);
    color: #fff;
  }
  .spotlight__text {
    display: flex; flex-direction: column;
    min-width: 0;
  }
  .spotlight__title {
    font-weight: 600;
    font-size: 14px;
    color: var(--ink);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .spotlight__sub {
    font-size: 11.5px;
    color: var(--ink-60);
    margin-top: 1px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .spotlight__meta {
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-60);
    padding: 2px 8px;
    background: var(--cream);
    border-radius: 999px;
    white-space: nowrap;
  }
  .spotlight__kind {
    font-size: 10px;
    color: var(--ink-40);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .spotlight__foot {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    border-top: 1px solid var(--rule);
    background: var(--white);
    font-size: 11px;
    color: var(--ink-60);
  }
  .spotlight__foot .kbd-row { display: inline-flex; align-items: center; gap: 4px; }
  .spotlight__foot kbd {
    display: inline-block;
    background: var(--cream);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink);
  }
`;

const TRIGGER_HINT_CSS = `
  .spotlight-trigger {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: var(--cream-soft);
    border: 1px solid var(--rule);
    border-radius: 8px;
    color: var(--ink-60);
    cursor: pointer;
    font: inherit;
    font-size: 12.5px;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .spotlight-trigger:hover {
    background: var(--white);
    border-color: var(--orange);
    color: var(--ink);
  }
  .spotlight-trigger__label {
    min-width: 80px;
    text-align: left;
  }
  .spotlight-trigger__kbd {
    display: inline-flex; gap: 2px;
  }
  .spotlight-trigger__kbd kbd {
    display: inline-block;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    color: var(--ink-60);
    line-height: 1;
  }
`;
