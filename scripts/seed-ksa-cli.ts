import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { KSA_DATA } from '../src/seed/ksa-data';

dotenv.config();

async function run() {
  await mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost:27017/nest-commerce',
  );
  console.log('Connected to MongoDB');

  const Country = mongoose.connection.collection('countries');
  const Region = mongoose.connection.collection('regions');
  const City = mongoose.connection.collection('cities');

  let country = await Country.findOne({ code: 'SA' });
  if (!country) {
    const res = await Country.insertOne({
      name: { ar: 'المملكة العربية السعودية', en: 'Saudi Arabia' },
      code: 'SA',
      phoneCode: '+966',
      currency: 'SAR',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    country = await Country.findOne({ _id: res.insertedId });
  }

  for (const regionData of KSA_DATA) {
    let region = await Region.findOne({
      'name.ar': regionData.region.ar,
      country: country!._id,
    });
    if (!region) {
      const res = await Region.insertOne({
        name: regionData.region,
        country: country!._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      region = await Region.findOne({ _id: res.insertedId });
    }

    for (const cityData of regionData.cities) {
      const city = await City.findOne({
        'name.ar': cityData.ar,
        region: region!._id,
      });
      if (!city) {
        await City.insertOne({
          name: cityData,
          region: region!._id,
          country: country!._id,
          isDeliveryAvailable: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  console.log('✅ KSA Seeding Completed Successfully!');
  process.exit(0);
}

run().catch(console.error);
