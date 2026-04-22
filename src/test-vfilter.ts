import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  price: Number,
  priceAfterDiscount: Number,
  productId: mongoose.Schema.Types.ObjectId,
});
const Variant = mongoose.model('Variant', variantSchema);

const vFilter: any = {};
const min = 10;
const max = 100;
vFilter.$or = [
  {
    priceAfterDiscount: { $ne: null, $gte: min, $lte: max },
  },
  {
    $or: [
      { priceAfterDiscount: { $exists: false } },
      { priceAfterDiscount: null },
    ],
    price: { $gte: min, $lte: max },
  },
];

console.log('Variant filter:', Variant.find(vFilter).getFilter());
