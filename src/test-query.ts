import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({ name: String, category: String });
const Product = mongoose.model('Product', productSchema);

const filter = { _id: { $in: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()] } };

const baseQuery = Product.find(filter);

const mongoQuery = { category: "category1" };
baseQuery.find(mongoQuery);

console.log('Query filter:', baseQuery.getFilter());
