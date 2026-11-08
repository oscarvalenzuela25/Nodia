import { useCallback, useRef, useState } from "react";

interface Editor { scope: string; productId: string }

/** Transient UI ownership; it never changes the cart or persists a price. */
export function useSalePriceEditing(scope: string) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const owner = useRef<Editor | null>(null);
  const onEditingChange = useCallback((productId: string, editing: boolean) => {
    const current = owner.current;
    if (editing) {
      if (current?.scope === scope && current.productId !== productId) return;
      const next = { scope, productId };
      owner.current = next;
      setEditor(next);
    } else if (current?.scope === scope && current.productId === productId) {
      owner.current = null;
      setEditor(null);
    }
  }, [scope]);
  const blocksChange = useCallback((productId?: string) => {
    const current = owner.current;
    return current?.scope === scope && current.productId !== productId;
  }, [scope]);

  return { editingProductId: editor?.scope === scope ? editor.productId : null, onEditingChange, blocksChange };
}
