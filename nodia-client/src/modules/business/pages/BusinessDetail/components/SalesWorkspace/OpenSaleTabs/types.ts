export interface OpenSaleTab {
  id: string;
  number: number;
  amount: string | null;
  pending: boolean;
  busy: boolean;
}
export interface OpenSaleTabsProps {
  sales: OpenSaleTab[];
  activeId: string;
  panelId: string;
  disabled: boolean;
  onSelect: (id: string, source: "pointer" | "keyboard") => void;
  onClose: (id: string) => void;
}
export const saleTabId = (panelId: string, id: string) => `${panelId}-tab-${id}`;
