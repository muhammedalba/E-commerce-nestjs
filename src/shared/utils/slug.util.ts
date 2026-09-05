import slugify from 'slugify';
import { FilterQuery, Model, Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { toObjectId } from './mongo.util';

export async function generateUniqueSlug(
  name: string,
  model: Model<any>,
  excludeId?: Types.ObjectId | string,
  message?: string,
): Promise<string> {
  const slug = slugify(name.trim().toLowerCase(), {
    lower: true,
    strict: true,
  });
  const query: FilterQuery<any> = { slug };
  if (excludeId) {
    query._id = { $ne: toObjectId(excludeId) };
  }

  const exists = await model.exists(query);
  if (exists) {
    throw new BadRequestException(message || 'name already exists');
  }

  return slug;
}
