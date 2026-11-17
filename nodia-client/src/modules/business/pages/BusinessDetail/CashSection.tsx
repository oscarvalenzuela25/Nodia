import { useState } from "react";
import type { CashScope } from "../../infrastructure/cashTypes";
import CashTab from "./components/CashTab";
import InvoiceEditor from "./components/InvoicesTab/components/InvoiceModal/InvoiceEditor";

export default function CashSection(scope: CashScope) {
  const [invoiceId, setInvoiceId] = useState<string>();
  return (
    <>
      <CashTab businessId={scope.businessId} onEditInvoice={setInvoiceId} />
      {invoiceId && (
        <InvoiceEditor
          key={invoiceId}
          scope={scope}
          invoiceId={invoiceId}
          onClose={() => setInvoiceId(undefined)}
        />
      )}
    </>
  );
}
