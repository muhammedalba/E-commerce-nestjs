export const PRODUCT_EVENTS = {
  /**
   * A product was PERMANENTLY deleted (hard delete) — dependent modules clean
   * up their data. Soft delete does not emit this: it can still be restored.
   */
  DELETED: 'product.deleted',
} as const;

export class ProductDeletedEvent {
  constructor(public readonly productId: string) {}
}
