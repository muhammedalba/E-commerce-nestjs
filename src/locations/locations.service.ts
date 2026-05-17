import {
  Injectable,
  NotFoundException,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { Country, CountryDocument } from './shared/schema/country.schema';
import { Region, RegionDocument } from './shared/schema/region.schema';
import { City, CityDocument } from './shared/schema/city.schema';
import {
  CreateCityDto,
  CreateCountryDto,
  CreateRegionDto,
  UpdateCityDto,
  UpdateCountryDto,
  UpdateRegionDto,
} from './shared/dto/index';

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
    private readonly i18n: CustomI18nService,
  ) {}

  // ===========================================================================
  // COUNTRIES
  // ===========================================================================

  private async assertCountryNameUnique(
    nameAr: string,
    nameEn: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: any = {
      $or: [{ 'name.ar': nameAr.trim() }, { 'name.en': nameEn.trim() }],
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const exists = await this.countryModel.exists(filter);
    if (exists) {
      throw new BadRequestException(
        this.i18n.translate('exception.COUNTRY_NAME_EXISTS'),
      );
    }
  }

  private async assertCountryCodeUnique(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: any = { code: code.trim().toUpperCase() };
    if (excludeId) filter._id = { $ne: excludeId };

    const exists = await this.countryModel.exists(filter);
    if (exists) {
      throw new BadRequestException(
        this.i18n.translate('exception.COUNTRY_CODE_EXISTS'),
      );
    }
  }

  /**
   * Creates a new country and invalidates the countries cache.
   * @param data - The country data
   * @returns The created country document
   */
  async createCountry(data: CreateCountryDto): Promise<CountryDocument> {
    await this.assertCountryNameUnique(data.name.ar, data.name.en);
    await this.assertCountryCodeUnique(data.code);

    const country = await this.countryModel.create(data);
    await this.invalidateCountriesCache();
    return country;
  }

  /**
   * Retrieves all active countries, using cache if available.
   * @returns Array of active countries
   */
  async getCountries(isActive?: boolean): Promise<any[]> {
    const cacheKey = `locations:countries:${isActive ?? 'all'}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive;

    const countries = await this.countryModel
      .find(filter)
      .select('-__v')
      .sort({ 'name.ar': 1 })
      .lean();

    await this.cacheManager.set(cacheKey, countries, CACHE_TTL);
    return countries;
  }

  /**
   * Helper to invalidate all country-related cache keys.
   */
  private async invalidateCountriesCache() {
    await Promise.all([
      this.cacheManager.del('locations:countries:all'),
      this.cacheManager.del('locations:countries:true'),
      this.cacheManager.del('locations:countries:false'),
    ]);
  }

  /**
   * Updates an existing country and invalidates the countries cache.
   * @param id - Country ID
   * @param data - Update data
   * @returns The updated country document
   */
  async updateCountry(
    id: string,
    data: UpdateCountryDto,
  ): Promise<CountryDocument> {
    if (data.name) {
      const current = await this.countryModel.findById(id).lean();
      if (!current) throw new NotFoundException('Country not found');

      await this.assertCountryNameUnique(
        data.name.ar ?? current.name.ar,
        data.name.en ?? current.name.en,
        id,
      );
    }
    if (data.code) {
      await this.assertCountryCodeUnique(data.code, id);
    }

    const updated = await this.countryModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Country not found');
    await this.invalidateCountriesCache();
    return updated;
  }

  // ===========================================================================
  // REGIONS
  // ===========================================================================

  private async assertRegionUnique(
    nameAr: string,
    nameEn: string,
    countryId: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: any = {
      country: countryId,
      $or: [{ 'name.ar': nameAr.trim() }, { 'name.en': nameEn.trim() }],
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const exists = await this.regionModel.exists(filter);
    if (exists) {
      throw new BadRequestException(
        this.i18n.translate('exception.REGION_EXISTS'),
      );
    }
  }

  /**
   * Creates a new region and invalidates the regions cache for its country.
   * @param data - The region data
   * @returns The created region document
   */
  async createRegion(data: CreateRegionDto): Promise<RegionDocument> {
    await this.assertRegionUnique(
      data.name.ar,
      data.name.en,
      data.country.toString(),
    );

    const region = await this.regionModel.create(data);
    await this.invalidateRegionsCache(data.country.toString());
    return region;
  }

  /**
   * Retrieves all active regions for a specific country, using cache if available.
   * @param countryId - The ID of the country
   * @returns Array of active regions
   */
  async getRegionsByCountry(
    countryId: string,
    isActive?: boolean,
  ): Promise<any[]> {
    const cacheKey = `locations:regions:${countryId}:${isActive ?? 'all'}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const filter: any = { country: countryId };
    if (isActive !== undefined) filter.isActive = isActive;

    const regions = await this.regionModel
      .find(filter)
      .select('-__v')
      .sort({ 'name.ar': 1 })
      .lean();

    await this.cacheManager.set(cacheKey, regions, CACHE_TTL);
    return regions;
  }

  /**
   * Helper to invalidate all region-related cache keys for a country.
   */
  private async invalidateRegionsCache(countryId: string) {
    await Promise.all([
      this.cacheManager.del(`locations:regions:${countryId}:all`),
      this.cacheManager.del(`locations:regions:${countryId}:true`),
      this.cacheManager.del(`locations:regions:${countryId}:false`),
    ]);
  }

  /**
   * Updates an existing region.
   * @param id - Region ID
   * @param data - Update data
   * @returns The updated region document
   */
  async updateRegion(
    id: string,
    data: UpdateRegionDto,
  ): Promise<RegionDocument> {
    if (data.name) {
      const current = await this.regionModel.findById(id).lean();
      if (!current) throw new NotFoundException('Region not found');

      const countryId = (data.country ?? current.country).toString();
      await this.assertRegionUnique(
        data.name.ar ?? current.name.ar,
        data.name.en ?? current.name.en,
        countryId,
        id,
      );
    }

    const updated = await this.regionModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Region not found');
    if (updated.country) {
      await this.invalidateRegionsCache(updated.country.toString());
    }
    return updated;
  }

  // ===========================================================================
  // CITIES
  // ===========================================================================

  private async assertCityUnique(
    nameAr: string,
    nameEn: string,
    regionId: string,
    excludeId?: string,
  ): Promise<void> {
    const filter: any = {
      region: regionId,
      $or: [{ 'name.ar': nameAr.trim() }, { 'name.en': nameEn.trim() }],
    };
    if (excludeId) filter._id = { $ne: excludeId };

    const exists = await this.cityModel.exists(filter);
    if (exists) {
      throw new BadRequestException(
        this.i18n.translate('exception.CITY_EXISTS'),
      );
    }
  }

  /**
   * Creates a new city and invalidates the cities cache for its region.
   * @param data - The city data
   * @returns The created city document
   */
  async createCity(data: CreateCityDto): Promise<CityDocument> {
    await this.assertCityUnique(
      data.name.ar,
      data.name.en,
      data.region.toString(),
    );

    const city = await this.cityModel.create(data);
    await this.invalidateCitiesCache(data.region.toString());
    return city;
  }

  /**
   * Retrieves all active cities for a specific region, using cache if available.
   * @param regionId - The ID of the region
   * @returns Array of active cities
   */
  async getCitiesByRegion(
    regionId: string,
    isActive?: boolean,
  ): Promise<any[]> {
    const cacheKey = `locations:cities:${regionId}:${isActive ?? 'all'}`;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) return cached;

    const filter: any = { region: regionId };
    if (isActive !== undefined) filter.isActive = isActive;

    const cities = await this.cityModel
      .find(filter)
      .select('-__v')
      .sort({ 'name.ar': 1 })
      .lean();

    await this.cacheManager.set(cacheKey, cities, CACHE_TTL);
    return cities;
  }

  /**
   * Helper to invalidate all city-related cache keys for a region.
   */
  private async invalidateCitiesCache(regionId: string) {
    await Promise.all([
      this.cacheManager.del(`locations:cities:${regionId}:all`),
      this.cacheManager.del(`locations:cities:${regionId}:true`),
      this.cacheManager.del(`locations:cities:${regionId}:false`),
    ]);
  }

  /**
   * Retrieves detailed information for a specific city including populated region and country.
   * @param id - City ID
   * @returns Detailed city object
   */
  async getCityById(id: string): Promise<any> {
    const city = await this.cityModel
      .findById(id)
      .populate('region', 'name')
      .populate('country', 'name code')
      .lean();

    if (!city) throw new NotFoundException('City not found');
    return city;
  }

  /**
   * Updates an existing city.
   * @param id - City ID
   * @param data - Update data
   * @returns The updated city document
   */
  async updateCity(id: string, data: UpdateCityDto): Promise<CityDocument> {
    if (data.name) {
      const current = await this.cityModel.findById(id).lean();
      if (!current) throw new NotFoundException('City not found');

      const regionId = (data.region ?? current.region).toString();
      await this.assertCityUnique(
        data.name.ar ?? current.name.ar,
        data.name.en ?? current.name.en,
        regionId,
        id,
      );
    }

    const updated = await this.cityModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('City not found');
    if (updated.region) {
      await this.invalidateCitiesCache(updated.region.toString());
    }
    return updated;
  }
}
