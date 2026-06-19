/**
 * Crestly Icon Set
 *
 * Verbatim SVG path strings from erp/includes/header.php and erp/lib/nav.php.
 * 24×24 grid · stroke="currentColor" · stroke-width="1.75" (NEVER 2) ·
 * stroke-linecap="round" · stroke-linejoin="round" · fill="none".
 *
 * Do NOT swap to lucide-react/heroicons — the curves and weights are part
 * of Crestly's visual identity.
 */
import { forwardRef, type SVGProps } from "react";

const PATHS: Record<string, JSX.Element> = {
  // Layout / nav -----------------------------------------------------------
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </>
  ),
  diary: (
    <>
      <path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </>
  ),
  leaves: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M8 2v4M16 2v4M8 13h4" />
    </>
  ),
  punch: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  "review-history": (
    <>
      <rect x="3" y="3" width="13" height="18" rx="1.5" />
      <path d="M8 11l2 2 4-4" />
    </>
  ),
  salary: <path d="M7 6h10M7 10h10M8 6c5 0 7 4 0 6h-1l7 8" />,
  "staff-attendance": (
    <>
      <circle cx="12" cy="13" r="4" />
      <path d="M3 7h4l2-3h6l2 3h4v12H3z" />
    </>
  ),
  attendance: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M8 2v4M16 2v4M8 14l2.5 2.5L16 11" />
    </>
  ),
  classes: (
    <>
      <rect x="3" y="4" width="18" height="14" rx="1.5" />
      <path d="M3 9h18M8 4v14M16 4v14" />
    </>
  ),
  exams: (
    <>
      <path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
      <path d="M8 8h7M8 12h7M8 16h4" />
    </>
  ),
  families: (
    <>
      <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M3 21c1-4 4-6 9-6s8 2 9 6" />
    </>
  ),
  hostel: (
    <>
      <path d="M3 21V10l9-6 9 6v11" />
      <path d="M9 21V13h6v8" />
    </>
  ),
  streams: (
    <>
      <path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H3z" />
      <path d="M8 13h8" />
    </>
  ),
  students: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M14 19c.3-2 1.7-3.2 3-3.2s2.7 1.2 3 3.2" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5" />
      <circle cx="17" cy="10" r="2.2" />
      <path d="M14 19c.3-2 1.7-3.2 3-3.2s2.7 1.2 3 3.2" />
    </>
  ),
  timetable: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M9 9v12M15 9v12" />
    </>
  ),
  admissions: (
    <>
      <path d="M9 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      <path d="M3 20c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
      <path d="M17 8h4M19 6v4" />
    </>
  ),
  "follow-ups": (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M8 2v4M16 2v4M9 14l2 2 4-4" />
    </>
  ),

  // Finance ----------------------------------------------------------------
  "fee-ledger": (
    <>
      <path d="M5 4h11a4 4 0 0 1 0 8H9" />
      <path d="M5 8h11M5 12l9 9" />
    </>
  ),
  "fee-structure": (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </>
  ),
  ledger: (
    <>
      <path d="M5 3h14v18l-3-2-3 2-3-2-3 2-3-2z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  vouchers: (
    <>
      <path d="M3 7h18l-1 5h-1l-1 5H6l-1-5H4z" />
      <path d="M8 12h8" />
    </>
  ),
  "daily-report": (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M8 14l2.5 2.5L16 12" />
    </>
  ),
  transport: (
    <>
      <rect x="3" y="6" width="15" height="11" rx="2" />
      <circle cx="7" cy="19" r="2" />
      <circle cx="15" cy="19" r="2" />
      <path d="M18 9h3v6h-3" />
    </>
  ),

  // System -----------------------------------------------------------------
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  features: (
    <>
      <path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
    </>
  ),
  notifications: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  approvals: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  promotion: (
    <>
      <path d="M7 17l5-5 5 5" />
      <path d="M12 12V3M5 21h14" />
    </>
  ),
  import: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  shifts: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  hr: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  holidays: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="1.5" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <circle cx="12" cy="14" r="2" fill="currentColor" />
    </>
  ),

  // Generic actions --------------------------------------------------------
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  "chev-down": <path d="M6 9l6 6 6-6" />,
  "chev-right": <path d="M9 6l6 6-6 6" />,
  "chev-left": <path d="M15 6l-6 6 6 6" />,
  check: <path d="M5 12l5 5L20 7" />,
  x: <path d="M6 6l12 12M6 18L18 6" />,
  print: (
    <>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  msg: <path d="M21 12a8 8 0 1 1-3-6.2L21 4l-1 4.2A8 8 0 0 1 21 12z" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  rupee: <path d="M7 6h10M7 10h10M8 6c5 0 7 4 0 6h-1l7 8" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </>
  ),
  "user-plus": (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21c0-4 3-7 6-7s6 3 6 7" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  "user-check": (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21c0-4 3-7 6-7s6 3 6 7" />
      <path d="M16 11l2 2 4-4" />
    </>
  ),
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  upload: <path d="M12 21V9M7 14l5-5 5 5M5 3h14" />,
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13 6l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M3 21l1.65-3.8A9 9 0 1 1 8.5 20.4z" />
      <path d="M9 9c.4.7 1.2 1.7 2.2 2.7s2 1.8 2.7 2.2c.6.4 1.3.4 1.8 0l.7-.7c.4-.4 1-.5 1.5-.2l1.7 1c.5.3.7 1 .4 1.5l-.6 1.1c-.5.9-1.6 1.4-2.6 1.1a13 13 0 0 1-7.4-7.4c-.3-1 .2-2.1 1.1-2.6l1.1-.6c.5-.3 1.2-.1 1.5.4l1 1.7c.3.5.2 1.1-.2 1.5l-.7.7c-.4.5-.4 1.2 0 1.8z" />
    </>
  ),
  // Filled-in gaps used across the apps -----------------------------------
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="8" r="3" />
      <path d="M16 20a6.5 6.5 0 0 1 5.5-6.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  library: (
    <>
      <path d="M4 3v18M20 3v18" />
      <rect x="7" y="4" width="3" height="16" />
      <rect x="11" y="6" width="3" height="14" />
      <path d="M15 7l2.5-.7L20 16l-2.5.7z" />
    </>
  ),
  phone: (
    <>
      <path d="M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16M7 12h10M10 19h4" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l4-1 11-11-3-3L5 16z" />
      <path d="M14 6l3 3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  name: IconName;
  /** Pixel size for both width and height. Default 14 (matches PHP sidebar). */
  size?: number;
  /** Stroke width — never override unless you have a very good reason. */
  strokeWidth?: number;
}

/**
 * <Icon name="students" size={14} />
 *
 * All icons use currentColor so style with `color:` on the parent.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size = 14, strokeWidth = 1.75, ...rest },
  ref,
) {
  const body = PATHS[name];
  if (!body) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[@crestly/icons] unknown icon "${name}"`);
    }
    return null;
  }
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {body}
    </svg>
  );
});

/**
 * Crestly logo · 100×100 SVG · brand-locked colours (do not change).
 * Used in the sidebar brand block and the login screen.
 */
export const CrestlyLogo = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function CrestlyLogo(
  props,
  ref,
) {
  return (
    <svg ref={ref} viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <rect width="100" height="100" rx="22" fill="#100D0A" />
      <path
        d="M 80 36 A 34 34 0 1 0 80 68 L 58.25 68 A 18 18 0 1 1 58.25 36 Z"
        fill="#F5EFE3"
        fillRule="evenodd"
      />
      <circle cx="72" cy="78" r="6.5" fill="#F25C19" />
    </svg>
  );
});
