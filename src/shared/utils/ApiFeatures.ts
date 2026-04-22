import { Query, Types } from 'mongoose';
import { QueryString } from './interfaces/queryInterface';

export class ApiFeatures<T> {
  private mongooseQuery: Query<T[], T>;
  private queryString: QueryString;
  private paginationResult: Record<string, any> = {};

  constructor(mongooseQuery: Query<T[], T>, queryString: QueryString) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };

    const excludedFields = [
      'page',
      'limit',
      'fields',
      'sort',
      'keywords',
      'allLangs',
    ];
    excludedFields.forEach((field) => delete queryObj[field]);

    const allowedFilters = [
      'category',
      'supCategories',
      'brand',
      'supplier',
      'isUnlimitedStock',
      'stockSummary',
      'isFeatured',
      'disabled',
      'isDeleted',
      'rating',
      'ratingsQuantity',
      'ratingsAverage',
      'variantCount',
      'name',
      'user',
      'email',
      'isActive',
      'priceRange', // مهم
      'totalSold',
    ];

    const mongoQuery: Record<string, any> = {};

    // -----------------------------------------
    // 1️⃣ دعم pricerange[min] و pricerange[max]
    // -----------------------------------------
    for (const key in queryObj) {

      const match = key.match(/^pricerange\[(min|max)\]$/i);
      if (match) {
        const type = match[1]; // min أو max
        const value = Number(queryObj[key]);

        if (!isNaN(value)) {
          if (type === 'min') {
            mongoQuery['priceRange.min'] = { $gte: value };
          }
          if (type === 'max') {
            mongoQuery['priceRange.max'] = { $lte: value };
          }
        }

        delete queryObj[key];
      }
    }

    // -----------------------------------------------------
    // 2️⃣ فلاتر operators مثل: field[gte], field[lte], field[in]
    // -----------------------------------------------------
    for (const key in queryObj) {
      const match = key.match(/^(\w+)\[(gte|lte|lt|gt|in|ne|nin)\]$/);

      if (match) {
        const field = match[1];
        const operator = match[2];
        if (!allowedFilters.includes(field)) continue;

        if (!mongoQuery[field] || typeof mongoQuery[field] !== 'object') {
          mongoQuery[field] = {};
        }

        const value = queryObj[key];
        console.log("key",key); 
        if (operator === 'in' || operator === 'nin') {
          mongoQuery[field][`$${operator}`] = value.split(',');
        } else {
          const num = Number(value);
          if (!isNaN(num)) {
            mongoQuery[field][`$${operator}`] = num;
          }
        }
      }
    }

    // -----------------------------------------
    // 3️⃣ الفلاتر المباشرة مثل: ?brand=Apple
    // -----------------------------------------
    for (const key in queryObj) {
      if (allowedFilters.includes(key) && !(key in mongoQuery)) {
        let val = queryObj[key];

        if (val === 'true') val = true;
        if (val === 'false') val = false;

        if (typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val)) {
          mongoQuery[key] = new Types.ObjectId(val);
        } else {
          mongoQuery[key] = val;
        }
      }
    }

    this.mongooseQuery = this.mongooseQuery.find(mongoQuery);
    return this;
  }



  sort() {
    const sortParam = this.queryString?.sort;
    if (sortParam) {
      // split by comma and filter out empty fields
      const sortBy = sortParam
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field !== '')
        .join(' '); // Mongoose expects space-separated fields
      if (sortBy) {
        this.mongooseQuery = this.mongooseQuery.sort(sortBy);
      } else {
        // fallback default sort
        this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
      }
    } else {
      // default sorting if no sort param is provided
      this.mongooseQuery = this.mongooseQuery.sort('-createdAt');
    }

    return this;
  }

  limitFields() {
    if (this.queryString?.fields) {
      const fields = this.queryString.fields
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field !== '')
        .join('');
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select('-__v');
    }
    return this;
  }

  search(modelName: string) {
    if (this.queryString?.keywords && this.queryString.keywords.length > 0) {
      // Escape special characters to prevent invalid regular expression errors
      const keyword = this.queryString.keywords
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      let query: object;
      switch (modelName) {
        case 'Product':
          query = {
            $or: [
              { 'title.en': { $regex: keyword, $options: 'i' } },
              { 'title.ar': { $regex: keyword, $options: 'i' } },
              { 'description.en': { $regex: keyword, $options: 'i' } },
              { 'description.ar': { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        case 'Carousel':
          query = {
            $or: [
              { 'description.en': { $regex: keyword, $options: 'i' } },
              { 'description.ar': { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        case 'User':
          query = {
            $or: [
              { 'name.en': { $regex: keyword, $options: 'i' } },
              { 'name.ar': { $regex: keyword, $options: 'i' } },
              { email: { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        case 'suppliers':
          query = {
            $or: [
              { name: { $regex: keyword, $options: 'i' } },
              { email: { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        case 'Order':
          query = {
            $or: [
              {
                'shippingAddress.firstName': { $regex: keyword, $options: 'i' },
              },
              {
                'shippingAddress.lastName': { $regex: keyword, $options: 'i' },
              },
            ],
          };
          break;
        default:
          query = {
            $or: [
              { 'name.en': { $regex: keyword, $options: 'i' } },
              { 'name.ar': { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
      }

      this.mongooseQuery = this.mongooseQuery.find(query);
    }

    return this;
  }

  paginate(totalDocuments: number) {
    const page = parseInt(this.queryString.page ?? '1', 10);
    const limit = parseInt(this.queryString.limit ?? '15', 10);
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    const pagination: Record<string, any> = {
      currentPage: page,
      limit,
      numberOfPages: Math.ceil(totalDocuments / limit),
    };

    if (endIndex < totalDocuments) {
      pagination.nextPage = page + 1;
    }
    if (skip > 0) {
      pagination.prevPage = page - 1;
    }

    this.paginationResult = pagination;
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);

    return this;
  }
  getQuery() {
    return this.mongooseQuery;
  }

  getPagination() {
    return this.paginationResult;
  }
}
