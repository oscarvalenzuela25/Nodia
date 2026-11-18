import { useId, type ReactNode } from "react";
import { Button } from "@mui/material";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { CashCategoryFields } from "../../pages/BusinessDetail/components/CashTab/CashEditors/CashEditorFields";
import { CashMutationFeedback } from "../../pages/BusinessDetail/components/CashTab/CashEditors/CashMutationFeedback";
import { categoryFields, type CategoryFields } from "../../pages/BusinessDetail/components/CashTab/CashEditors/fields";
import type { CashCategory, CashMutationOutcome, CashScope } from "../../infrastructure/cashTypes";
import { useCashMutation } from "../../infrastructure/useCashServices";
import { QuickCategoryFields } from "./styles";

interface QuickCategoryView {
  content: ReactNode;
  actions: ReactNode;
  locked: boolean;
  onClose: () => void;
}

interface Props {
  scope: CashScope;
  onCreated: (category: CashCategory) => void;
  onCancel: () => void;
  children: (view: QuickCategoryView) => ReactNode;
}

export function QuickCashCategoryForm({ scope, onCreated, onCancel, children }: Props) {
  const { t } = useTranslation("core");
  const formId = useId();
  const form = useForm<CategoryFields>({
    resolver: zodResolver(categoryFields),
    defaultValues: { name: "", description: "", is_active: true },
  });
  const mutation = useCashMutation(scope);
  const locked = mutation.busy || mutation.pending;
  const onClose = () => { if (!locked) onCancel(); };
  const apply = (outcome: CashMutationOutcome | undefined) => {
    if (outcome?.status === "committed" && outcome.operation === "category_create") {
      onCreated(outcome.result.category);
    }
  };
  const save = form.handleSubmit(async (fields) => {
    apply(await mutation.submit({ operation: "category_create", fields }));
  });

  return children({
    locked,
    onClose,
    content: (
      <>
        <QuickCategoryFields id={formId} noValidate onSubmit={(event) => { void save(event); }}>
          <CashCategoryFields control={form.control} disabled={locked} hideActivity />
        </QuickCategoryFields>
        <CashMutationFeedback
          busy={mutation.busy}
          outcome={mutation.outcome}
          onRecover={() => { void mutation.recover().then(apply); }}
          onRetry={() => { void mutation.retry().then(apply); }}
        />
      </>
    ),
    actions: (
      <>
        <Button variant="outlined" disabled={locked} onClick={onClose}>{t("core:cancel")}</Button>
        <Button variant="contained" type="submit" form={formId} disabled={locked}>{t("core:save")}</Button>
      </>
    ),
  });
}
