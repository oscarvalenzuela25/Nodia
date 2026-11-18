export interface ShoppingListSummary {
  id: string;
  name: string;
  is_active: boolean;
  version: number;
  item_count: number;
}

export interface ShoppingListCheck {
  id: string;
  checked: boolean;
  check_version: number;
}

export interface ShoppingListItem extends ShoppingListCheck {
  product_id: string;
  name: string;
  quantity: string;
  position: number;
  available: boolean;
}

export interface ShoppingListDetail extends ShoppingListSummary {
  items: ShoppingListItem[];
}

export interface ShoppingListPage {
  items: ShoppingListSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ShoppingListItemCommand {
  product_id: string;
  quantity: string;
  item_id?: string;
}

export interface ShoppingListContent {
  name: string;
  items: ShoppingListItemCommand[];
}

export interface ShoppingListItemIdentity {
  id: string;
  product_id: string;
}
