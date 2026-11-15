import ProductModal, { type ProductFormData } from "../ProductsTab/components/ProductModal";
import type { ProductSaveTarget } from "../ProductsTab/components/ProductModal/hooks/useDeferredProductSave";
import { useCreateProduct, useUpdateProduct } from "../../../../infrastructure/useServices";
import { usePagedProviderOptions } from "../../../../infrastructure/usePagedOptions";
import type { ProductEntity } from "../../../../infrastructure/types";

type Props = { businessId: string; barcode: string; onClose: () => void; onRegistered: (product: ProductEntity) => void | Promise<void> };

/** Product registration reuses field/image recovery; it never writes a sale. */
export default function PosProductRegistration({ businessId, barcode, onClose, onRegistered }: Props) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const providers = usePagedProviderOptions(businessId);
  const save = async (data: ProductFormData, target?: ProductSaveTarget): Promise<ProductEntity> => {
    const { expected_version, has_stock, ...fields } = data;
    if (has_stock === null) throw new Error("product:availability_required");
    if (target) return update.mutateAsync({ id: target.id, payload: { ...fields, has_stock, expected_version: target.version ?? expected_version } });
    return create.mutateAsync({ ...fields, business_id: businessId, has_stock });
  };
  return <ProductModal open businessId={businessId} initialBarcode={barcode} onClose={onClose} onSubmit={save} onSaved={onRegistered}
    providers={providers.providers} isSubmitting={create.isPending || update.isPending}
    providerSearch={{ onSearchChange: providers.setSearch, hasMore: providers.hasNextPage, loadingOptions: providers.isFetching,
      onLoadMore: () => { if (!providers.isFetching) void providers.fetchNextPage(); } }} />;
}
