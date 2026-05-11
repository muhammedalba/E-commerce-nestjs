import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Country, CountryDocument } from './shared/schema/country.schema';
import { Region, RegionDocument } from './shared/schema/region.schema';
import { City, CityDocument } from './shared/schema/city.schema';

const CACHE_TTL = 86400000; // 24 hours

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Country.name)
    private readonly countryModel: Model<CountryDocument>,

    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,

    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,

    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async createCountry(data: Partial<Country>): Promise<CountryDocument> {
    const country = await this.countryModel.create(data);
    await this.cacheManager.del('locations:countries');
    return country;
  }

  async getCountries(): Promise<any[]> {
    const cacheKey = 'locations:countries';
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const countries = await this.countryModel
      .find({ isActive: true })
      .select('-__v')
      .lean();

    await this.cacheManager.set(cacheKey, countries, CACHE_TTL);
    return countries;
  }

  async updateCountry(
    id: string,
    data: Partial<Country>,
  ): Promise<CountryDocument> {
    const updated = await this.countryModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Country not found');
    await this.cacheManager.del('locations:countries');
    return updated;
  }

  async createRegion(data: Partial<Region>): Promise<RegionDocument> {
    const region = await this.regionModel.create(data);
    await this.cacheManager.del(`locations:regions:${data.country}`);
    return region;
  }

  async getRegionsByCountry(countryId: string): Promise<any[]> {
    const cacheKey = `locations:regions:${countryId}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const regions = await this.regionModel
      .find({ country: countryId, isActive: true })
      .select('-__v')
      .lean();

    await this.cacheManager.set(cacheKey, regions, CACHE_TTL);
    return regions;
  }

  async updateRegion(
    id: string,
    data: Partial<Region>,
  ): Promise<RegionDocument> {
    const updated = await this.regionModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Region not found');
    return updated;
  }

  async createCity(data: Partial<City>): Promise<CityDocument> {
    const city = await this.cityModel.create(data);
    await this.cacheManager.del(`locations:cities:${data.region}`);
    return city;
  }

  async getCitiesByRegion(regionId: string): Promise<any[]> {
    const cacheKey = `locations:cities:${regionId}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const cities = await this.cityModel
      .find({ region: regionId, isActive: true })
      .select('-__v')
      .lean();

    await this.cacheManager.set(cacheKey, cities, CACHE_TTL);
    return cities;
  }

  async getCityById(id: string): Promise<any> {
    const city = await this.cityModel
      .findById(id)
      .populate('region', 'name')
      .populate('country', 'name code')
      .lean();

    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  async updateCity(id: string, data: Partial<City>): Promise<CityDocument> {
    const updated = await this.cityModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('City not found');
    return updated;
  }
}
