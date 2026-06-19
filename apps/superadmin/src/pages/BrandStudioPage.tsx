import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";

/**
 * Brand Studio — AI-assisted marketing-image generator.
 *
 * The legacy PHP version (superadmin/branding.php + branding-generate.php)
 * supports two providers: a free local GD-based SVG composite engine, and
 * Ideogram API. Porting the local engine to Node needs `sharp` + a templated
 * SVG composition pipeline; that lands in Batch I (UI fidelity pass) along
 * with the brand-book download (ZIP of palette.css + logos + README).
 *
 * This stub keeps the route + nav alive and explains what's coming.
 */
export function BrandStudioPage() {
  return (
    <>
      <PageHead
        group="BRAND STUDIO"
        title="Brand Studio"
        lede="Mixed-script marketing prompts + per-slide AI image generator."
      />
      <div className="card">
        <Icon name="features" size={24} />
        <h2 className="display-s" style={{ marginTop: 12, fontSize: 22 }}>Coming in the UI-fidelity pass</h2>
        <p className="muted">
          The Brand Studio engine has two image providers:
        </p>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7, color: "var(--ink)" }}>
          <li><b>Local SVG composite</b> — free, deterministic; needs a Node port of the PHP GD pipeline (pebble decoration + middle band + headline / logo overlay using the bundled fonts).</li>
          <li><b>Ideogram API</b> — paid, straight HTTP call; key stored in <code className="mono">app_settings</code>.</li>
        </ul>
        <p className="muted">
          Catalog of generated prompts + slide JSON already lives in <code className="mono">brand_prompt_sets</code> / <code className="mono">brand_images</code>. The renderer + UI for picking feature × format × tone × audience × theme lands in Batch I.
        </p>
      </div>
    </>
  );
}
