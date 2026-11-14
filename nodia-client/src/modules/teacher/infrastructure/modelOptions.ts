import { catalogModelOptions } from "../../../utils/modelVariantOptions";
import type { CatalogModelOption } from "../../../utils/modelVariantOptions";
import type { ConnectionCatalog, SelectionDraft } from "./selection";

type Model = ConnectionCatalog["items"][number]["modes"][number]["models"][number];
export type ModelOption = CatalogModelOption<Model>;

export function teacherModelOptions(models: Model[], groupVariants: boolean, current: SelectionDraft): ModelOption[] {
  return catalogModelOptions(models, groupVariants, current);
}

export { chooseModelEffort, modelOptionComplete, modelOptionEfforts, modelOptionFor } from "../../../utils/modelVariantOptions";
