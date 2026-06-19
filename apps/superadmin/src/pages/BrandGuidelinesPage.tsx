import { PageHead } from "@/components/PageHead";

export function BrandGuidelinesPage() {
  return (
    <>
      <PageHead
        group="BRAND STUDIO"
        title="Brand guidelines"
        lede="The Crestly Design System summarised in one page."
      />

      <div className="card">
        <div className="display-s" style={{ marginBottom: 16, fontSize: 22 }}>Colour tokens</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
          {[
            ["Ink", "var(--ink)", "#100D0A"],
            ["Cream", "var(--cream)", "#F5EFE3"],
            ["Paper", "var(--paper)", "#FBF9F3"],
            ["Orange", "var(--orange)", "#F25C19"],
            ["Mint deep", "var(--tint-mint-deep)", "#3E7A50"],
            ["Wheat deep", "var(--tint-wheat-deep)", "#6E5418"],
            ["Sky deep", "var(--tint-sky-deep)", "#27517E"],
            ["Rose deep", "var(--tint-rose-deep)", "#A03A28"],
            ["Mustard deep", "var(--tint-mustard-deep)", "#7A5A18"],
          ].map(([name, css, hex]) => (
            <div key={name} style={{ border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ height: 56, background: css }} />
              <div style={{ padding: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{name}</div>
                <div className="muted mono" style={{ fontSize: 10 }}>{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 22 }}>Typography</div>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, letterSpacing: "-0.04em", margin: 0 }}>
          Display L · 56/800 · -0.04em
        </p>
        <p style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", margin: 8 }}>
          Display S · 24/700
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.55, margin: "12px 0 0" }}>
          Body · 14/1.55. Geist 300–900 + Geist Mono 400–600. No third family.
        </p>
        <p className="mono" style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", marginTop: 4 }}>
          Label · mono 10.5 / 0.14em / uppercase
        </p>
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 22 }}>Components</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <button className="btn btn--primary btn--sm">Primary</button>
          <button className="btn btn--ink btn--sm">Ink</button>
          <button className="btn btn--ghost btn--sm">Ghost</button>
          <button className="btn btn--danger btn--sm">Danger</button>
          <span className="pill pill--success"><span className="pill__dot" />SUCCESS</span>
          <span className="pill pill--warn">WARN</span>
          <span className="pill pill--error">ERROR</span>
          <span className="pill pill--info">INFO</span>
          <span className="cls-pill">10-A</span>
        </div>
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 22 }}>Download brand kit</div>
        <p className="muted body-s">
          The legacy version ships a ZIP with palette.css + logos + README. The Node port of that bundle lands in the UI fidelity pass.
        </p>
        <button className="btn btn--ghost" disabled>Download brand kit (coming soon)</button>
      </div>
    </>
  );
}
