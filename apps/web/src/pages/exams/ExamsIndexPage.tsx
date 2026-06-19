import { Link } from "react-router-dom";
import { Icon, type IconName } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useExamSubjects, useExamTerms } from "./hooks";

export function ExamsIndexPage() {
  const { data: terms } = useExamTerms();
  const { data: subjects } = useExamSubjects();
  const weightSum = (terms ?? []).reduce((s, t) => s + t.weightPercent, 0);

  return (
    <>
      <PageHead group="RECORDS" title="Exams & Results" lede="Configure terms, subjects, datesheets · enter marks · publish results." />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="exams" label="TERMS" value={String(terms?.length ?? "—")} delta={`${weightSum}% weight`} />
        <StatTile tint="mint" icon="features" label="SUBJECTS" value={String(subjects?.length ?? "—")} delta="" />
        <StatTile tint="sky" icon="calendar" label="WEIGHT TOTAL" value={`${weightSum}%`} delta={weightSum === 100 ? "OK" : "expected 100"} />
        <StatTile tint="rose" icon="check" label="FINALIZED" value={String((terms ?? []).filter((t) => t.isFinalized).length)} delta="locked terms" />
      </div>

      <div className="grid grid--cols-3 grid--gap-sm">
        <Shortcut to="/exams/terms" icon="exams" title="Terms" sub="PT1, HY, PT2, Annual · weights & finalize" />
        <Shortcut to="/exams/subjects" icon="features" title="Subjects" sub="Catalogue + per-class assignment" />
        <Shortcut to="/exams/datesheet" icon="calendar" title="Date Sheet" sub="Paper schedule per term + class" />
        <Shortcut to="/exams/marks" icon="exams" title="Enter Marks" sub="Per-term, per-subject roster entry" />
        <Shortcut to="/exams/results" icon="check" title="Class Results" sub="Rank list + grade distribution" />
        <Shortcut to="/exams/co-scholastic" icon="users" title="Co-Scholastic" sub="A/B/C across non-academic areas" />
      </div>
    </>
  );
}

function Shortcut({ to, icon, title, sub }: { to: string; icon: IconName; title: string; sub: string }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div className="stat-tile__icon icon-tint-wheat" style={{ width: 40, height: 40, borderRadius: 8, display: "grid", placeItems: "center" }}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div className="display-s" style={{ fontSize: 18, marginBottom: 2 }}>{title}</div>
        <p className="muted body-s" style={{ margin: 0 }}>{sub}</p>
      </div>
    </Link>
  );
}
