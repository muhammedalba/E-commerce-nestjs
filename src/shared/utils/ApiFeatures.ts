import { Query } from 'mongoose';
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
    const excludedFields = ['page', 'limit', 'fields', 'sort', 'keywords'];
    excludedFields.forEach((field) => delete queryObj[field]);

    const allowedFilters = [
      'status',
      'category',
      'price',
      'rating',
      'brand',
      'email',
    ];
    const mongoQuery: Record<string, any> = {};

    // أولوية للفلترة بشرط [lt],[gte], إلخ
    for (const key in queryObj) {
      const match = key.match(/^(\w+)\[(gte|lte|lt|gt|in|ne|nin)\]$/); // دعم in, ne, nin
      if (match) {
        const field = match[1];
        const operator = match[2];

        if (!allowedFilters.includes(field)) continue;

        if (!mongoQuery[field] || typeof mongoQuery[field] !== 'object') {
          mongoQuery[field] = {};
        }

        const value = queryObj[key];
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

    // الفلاتر المباشرة (مثل ?brand=Apple)
    for (const key in queryObj) {
      if (allowedFilters.includes(key) && !(key in mongoQuery)) {
        mongoQuery[key] = queryObj[key];
      }
    }
    this.mongooseQuery = this.mongooseQuery.find(mongoQuery);
    return this;
  }

  sort() {
    const sortParam = this.queryString.sort;

    if (sortParam) {
      // split by comma and filter out empty fields
      const sortBy = sortParam
        .split(',')
        .map((field) => field.trim())
        .filter((field) => field !== '')
        .join(' '); // Mongoose expects space-separated fields
      console.log(sortBy, 'sortBy');
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
    if (this.queryString.fields) {
      console.log(this.queryString.fields);

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
    if (this.queryString.keywords) {
      const keyword = this.queryString.keywords.trim();
      let query: object;

      switch (modelName) {
        case 'products':
          query = {
            $or: [
              { title: { $regex: keyword, $options: 'i' } },
              { description: { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        case 'users':
          query = {
            $or: [
              { name: { $regex: keyword, $options: 'i' } },
              { email: { $regex: keyword, $options: 'i' } },
            ],
          };
          break;
        default:
          query = { name: { $regex: keyword, $options: 'i' } };
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
