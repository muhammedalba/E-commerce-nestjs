export const searchStrategies: Record<string, (keyword: string) => object> = {
  Product: (keyword: string) => ({
    $or: [
      { 'title.en': { $regex: keyword, $options: 'i' } },
      { 'title.ar': { $regex: keyword, $options: 'i' } },
      { 'description.en': { $regex: keyword, $options: 'i' } },
      { 'description.ar': { $regex: keyword, $options: 'i' } },
    ],
  }),
  Carousel: (keyword: string) => ({
    $or: [
      { 'description.en': { $regex: keyword, $options: 'i' } },
      { 'description.ar': { $regex: keyword, $options: 'i' } },
    ],
  }),
  User: (keyword: string) => ({
    $or: [
      { 'name.en': { $regex: keyword, $options: 'i' } },
      { 'name.ar': { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } },
    ],
  }),
  PromoBanner: (keyword: string) => ({
    $or: [
      { 'text.en': { $regex: keyword, $options: 'i' } },
      { 'text.ar': { $regex: keyword, $options: 'i' } },
    ],
  }),
  Supplier: (keyword: string) => ({
    $or: [
      { name: { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } },
    ],
  }),
  Order: (keyword: string) => ({
    $or: [
      {
        'shippingAddress.firstName': { $regex: keyword, $options: 'i' },
      },
      {
        'shippingAddress.lastName': { $regex: keyword, $options: 'i' },
      },
    ],
  }),
  default: (keyword: string) => ({
    $or: [
      { 'name.en': { $regex: keyword, $options: 'i' } },
      { 'name.ar': { $regex: keyword, $options: 'i' } },
    ],
  }),
};
