import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { useForm } from "react-hook-form";
import { PageHead } from "@/components/PageHead";
import { useDeleteFamily, useFamily, useSaveFamily } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import { FamilyUpsertSchema, type FamilyUpsert } from "@crestly/shared";

const blank: FamilyUpsert = {
  fatherName: null,
  motherName: null,
  siblingCount: null,
  membersText: null,
};

export function FamilyEditPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const fid = familyId ? Number(familyId) : undefined;
  const isNew = fid === undefined;
  const navigate = useNavigate();

  const { data: existing, isLoading } = useFamily(fid);
  const save = useSaveFamily(fid);
  const remove = useDeleteFamily();
  const form = useForm<FamilyUpsert>({ defaultValues: blank });

  useEffect(() => {
    if (existing) {
      form.reset({
        familyId: existing.familyId,
        fatherName: existing.fatherName,
        motherName: existing.motherName,
        siblingCount: existing.siblingCount,
        membersText: existing.membersText,
      });
    }
  }, [existing, form]);

  async function onSubmit(values: FamilyUpsert) {
    const parsed = FamilyUpsertSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((i) => form.setError(i.path[0] as keyof FamilyUpsert, { message: i.message }));
      return;
    }
    try {
      const saved = await save.mutateAsync(parsed.data);
      navigate(`/families/${saved.familyId}`, { replace: true });
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Could not save family") });
    }
  }

  async function onDelete() {
    if (!fid) return;
    if (!confirm("Delete this family? Active children must be reassigned first.")) return;
    try {
      await remove.mutateAsync(fid);
      navigate("/families", { replace: true });
    } catch (err) {
      form.setError("root", { message: getErrorMessage(err, "Could not delete family") });
    }
  }

  if (!isNew && isLoading) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHead
        group="FAMILIES"
        title={isNew ? "Add a family" : `Edit family #${fid}`}
        actions={
          <Link to={isNew ? "/families" : `/families/${fid}`} className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <form className="card" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="form-section">
          <div className="form-section__head">
            <span className="form-section__num">01</span>
            <span className="form-section__title">Parents</span>
          </div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field__label">Father name</label>
              <input className="input" {...form.register("fatherName")} />
            </div>
            <div className="field">
              <label className="field__label">Mother name</label>
              <input className="input" {...form.register("motherName")} />
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section__head">
            <span className="form-section__num">02</span>
            <span className="form-section__title">Children</span>
          </div>
          <div className="form-grid form-grid--2">
            <div className="field">
              <label className="field__label">Total siblings</label>
              <input
                className="input"
                type="number"
                {...form.register("siblingCount", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label className="field__label">Members note</label>
              <textarea className="input input--area" {...form.register("membersText")} />
              <span className="field__hint">Free-form description; individual children are linked from each student's edit page.</span>
            </div>
          </div>
        </div>

        {form.formState.errors.root?.message && (
          <div className="banner banner--error" style={{ marginTop: 16 }}>
            <span>{form.formState.errors.root.message}</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 20 }}>
          <div>
            {!isNew && (
              <button type="button" className="btn btn--danger" onClick={onDelete}>
                Delete family
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={save.isPending}>
              {save.isPending ? "Saving…" : isNew ? "Create family" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
