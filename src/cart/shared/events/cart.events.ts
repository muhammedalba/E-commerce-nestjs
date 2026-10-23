export const CART_EVENTS = {
  /** Cart lines were added/updated/removed — a coupon applied to the old cart is no longer valid. */
  ITEMS_CHANGED: 'cart.items-changed',
} as const;

export class CartItemsChangedEvent {
  constructor(public readonly userId: string) {}
}
