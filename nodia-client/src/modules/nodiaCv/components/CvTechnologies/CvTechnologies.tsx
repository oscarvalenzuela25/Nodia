import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import { useTranslation } from "react-i18next";
import BaseModal from "../../../../components/BaseModal";
import TextInput from "../../../../components/inputs/TextInput";
import { getHttpErrorMessage } from "../../../../config/httpFeedback";
import {
  cvTechnologyName,
  type CvGeneration,
  type CvReviewSave,
  type CvTechnologyAddition,
  type CvTechnologyOption,
  type CvTechnologyReview,
} from "../../infrastructure/generationSchema";
import { cvHttpStatus, type CvReviewTarget } from "../../infrastructure/useCvGenerationWorkflow";
import { technologyGroup, initialCvTechnologies, rebaseCvTechnologies, technologyRows } from "./technologySelection";
import { technologyAction, technologyRow } from "./styles";

type Props = {
  view: CvReviewTarget;
  disabled: boolean;
  onSave: (input: CvReviewSave) => Promise<void>;
  onReload: () => Promise<CvGeneration["review"]>;
};
type Editor = { fixedName?: string; name: string; source: string; detail: string };
const groups = ["matched", "other", "missing"] as const;
const maximum = 64;

export default function CvTechnologies({ view, disabled, onSave, onReload }: Props) {
  const { t } = useTranslation("nodiaCv");
  const formId = useId();
  const saving = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [changes, setChanges] = useState<{ revision: number; baseline: CvTechnologyReview; values: CvTechnologyReview } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState<"invalid" | "duplicate" | "maximum" | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [atLimit, setAtLimit] = useState(false);
  const review = view.receipt.review;
  if (!review) return null;
  const current = initialCvTechnologies(view.receipt);
  const values = changes?.values ?? current;
  const options = view.receipt.technology_options ?? [];
  const rows = technologyRows(options, values.additions);
  const locked = disabled || isSaving;
  const stale = Boolean(changes && changes.revision !== review.revision) || cvHttpStatus(saveError) === 409;
  const selectionLocked = locked || stale;
  const update = (next: CvTechnologyReview) => {
    setSaveError(null);
    setAtLimit(false);
    setChanges({ revision: changes?.revision ?? review.revision, baseline: changes?.baseline ?? current, values: next });
  };
  const toggle = (name: string, checked: boolean) => {
    if (checked && values.included.length >= maximum) {
      setAtLimit(true);
      return;
    }
    update({
      ...values,
      included: checked ? [...values.included, name] : values.included.filter((item) => item !== name),
    });
  };
  const startEditing = (name?: string, existing?: CvTechnologyAddition) => {
    setEditorError(null);
    setEditor({
      fixedName: name,
      name: name ?? "",
      source: existing?.status === "confirmed" ? existing.source : "",
      detail: existing?.status === "confirmed" ? existing.detail : "",
    });
  };
  const commitAddition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || selectionLocked) return;
    const name = cvTechnologyName.safeParse(editor.name);
    const source = editor.source.trim();
    const detail = editor.detail.trim();
    if (!name.success || !source || !detail || source.length > 160 || detail.length > 600) {
      setEditorError("invalid");
      return;
    }
    if (!editor.fixedName && rows.some((row) => technologyKey(row.name) === technologyKey(name.data))) {
      setEditorError("duplicate");
      return;
    }
    const included = values.included.includes(name.data);
    const others = values.additions.filter((item) => item.name !== name.data);
    if ((!included && values.included.length >= maximum) || others.length >= maximum) {
      setEditorError("maximum");
      return;
    }
    update({
      included: included ? values.included : [...values.included, name.data],
      additions: [...others, { name: name.data, status: "confirmed", source, detail }],
    });
    setEditor(null);
  };
  const toggleStudy = (row: CvTechnologyOption, existing?: CvTechnologyAddition) => {
    if (!existing && values.additions.length >= maximum) {
      setAtLimit(true);
      return;
    }
    update({
      included: values.included,
      additions: existing?.status === "study"
        ? values.additions.filter(({ name }) => name !== row.name)
        : [...values.additions, { name: row.name, status: "study" }],
    });
  };
  const save = async () => {
    if (selectionLocked || saving.current || !changes) return;
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        revision: changes.revision,
        included_fact_ids: review.included_fact_ids,
        evidence: review.evidence,
        technologies: changes.values,
      });
      setChanges(null);
    } catch (error) {
      setSaveError(error);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  const reload = async () => {
    if (saving.current || !changes) return;
    saving.current = true;
    setIsSaving(true);
    try {
      const latest = await onReload();
      if (!latest) throw new Error("Missing CV review");
      const baseline = initialCvTechnologies({ ...view.receipt, review: latest });
      setChanges({
        revision: latest.revision,
        baseline,
        values: rebaseCvTechnologies(changes.baseline, changes.values, baseline),
      });
      setSaveError(null);
    } catch (error) {
      setSaveError(error);
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      {stale && (
        <Alert severity="warning" action={
          <Button color="inherit" disabled={locked} onClick={() => void reload()}>
            {t("technologies.reload")}
          </Button>
        }>{t("technologies.stale")}</Alert>
      )}
      {saveError !== null && !stale && <Alert severity="error">{getHttpErrorMessage(saveError)}</Alert>}
      {atLimit && <Alert severity="info">{t("technologies.maximum")}</Alert>}
      {rows.length === 0 && <Typography variant="body2" color="text.secondary">{t("technologies.empty")}</Typography>}
      {groups.map((group) => {
        const items = rows.filter((row) => technologyGroup(row) === group);
        if (!items.length) return null;
        return (
          <Stack key={group} component="section" spacing={0.5}>
            <Typography component="h4" variant="subtitle2">{t(`technologies.${group}`)}</Typography>
            {items.map((row) => {
              const addition = values.additions.find(({ name }) => name === row.name);
              const known = row.in_profile || addition?.status === "confirmed";
              const label = addition?.status ?? (!row.in_profile && (row.kind === "required" || row.kind === "preferred")
                ? `${row.kind}_missing` : row.kind);
              return (
                <Stack key={row.name} sx={technologyRow}>
                  <FormControlLabel
                    sx={{ minWidth: 0, m: 0, flex: "1 1 160px" }}
                    control={<Checkbox size="small" checked={values.included.includes(row.name)}
                      disabled={selectionLocked || !known} onChange={(_, checked) => toggle(row.name, checked)} />}
                    label={<Stack sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>{row.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{t(`technologies.${label}`)}</Typography>
                    </Stack>}
                  />
                  {!row.in_profile && (
                    <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 0.5, pl: { xs: 0.75, sm: 0 } }}>
                      <Button size="small" sx={technologyAction} disabled={selectionLocked}
                        aria-label={`${t(addition?.status === "confirmed" ? "technologies.edit" : "technologies.confirm")} · ${row.name}`}
                        onClick={() => startEditing(row.name, addition)}>
                        {t(addition?.status === "confirmed" ? "technologies.edit" : "technologies.confirm")}
                      </Button>
                      {addition?.status !== "confirmed" && <Button size="small" sx={technologyAction} disabled={selectionLocked}
                        aria-label={`${t(addition?.status === "study" ? "technologies.remove_study" : "technologies.to_study")} · ${row.name}`}
                        onClick={() => toggleStudy(row, addition)}>
                        {t(addition?.status === "study" ? "technologies.remove_study" : "technologies.to_study")}
                      </Button>}
                    </Stack>
                  )}
                </Stack>
              );
            })}
          </Stack>
        );
      })}
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <Button startIcon={<AddRounded />} disabled={selectionLocked} onClick={() => startEditing()} sx={technologyAction}>
          {t("technologies.add")}
        </Button>
        <Typography role="status" variant="caption" color="text.secondary">
          {t("technologies.selected", { count: values.included.length })}
          {changes && <> · {t("technologies.pending")}</>}
        </Typography>
        <Button variant="contained" loading={isSaving} disabled={selectionLocked || !changes}
          onClick={() => void save()} sx={[technologyAction, { width: { xs: "100%", sm: "auto" } }]}>
          {t("technologies.save")}
        </Button>
      </Stack>
      {editor && (
        <BaseModal open title={t(editor.fixedName ? "technologies.confirm" : "technologies.add")}
          onClose={() => setEditor(null)} actions={<>
            <Button onClick={() => setEditor(null)} variant="outlined" sx={technologyAction}>{t("core:cancel")}</Button>
            <Button form={formId} type="submit" variant="contained" disabled={selectionLocked} sx={technologyAction}>{t("review_confirm")}</Button>
          </>}>
          <Stack component="form" id={formId} spacing={2} onSubmit={commitAddition}>
            {editorError && <Alert severity="error">{t(`technologies.${editorError}`)}</Alert>}
            <TextInput label={t("technologies.name")} value={editor.name} required
              disabled={Boolean(editor.fixedName) || selectionLocked}
              onChange={(event) => setEditor({ ...editor, name: event.target.value })} />
            <TextInput label={t("review_source")} value={editor.source} required disabled={selectionLocked}
              onChange={(event) => setEditor({ ...editor, source: event.target.value })} />
            <TextInput label={t("technologies.detail")} value={editor.detail} required disabled={selectionLocked} multiline minRows={3}
              onChange={(event) => setEditor({ ...editor, detail: event.target.value })} />
          </Stack>
        </BaseModal>
      )}
    </Stack>
  );
}

function technologyKey(name: string) {
  return name.trim().normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");
}
