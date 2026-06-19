import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";

export function BrandSettingsPage() {
  return (
    <>
      <PageHead
        group="BRAND STUDIO"
        title="Brand settings"
        lede="Per-feature screenshot uploads + Ideogram API key."
      />
      <div className="card">
        <Icon name="settings" size={24} />
        <h2 className="display-s" style={{ marginTop: 12, fontSize: 22 }}>Coming with Brand Studio</h2>
        <p className="muted">
          Stores: feature_key → screenshot path (used as the middle-band image on generated slides), and the Ideogram API key. The API endpoint lives alongside the renderer (Batch I).
        </p>
      </div>
    </>
  );
}
