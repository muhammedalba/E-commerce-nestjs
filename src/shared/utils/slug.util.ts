import slugify from 'slugify';
import { Model } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

export async function generateUniqueSlug(
  name: string,
  model: Model<any>,
  excludeId?: string | any,
  message?: string,
): Promise<string> {
  const slug = slugify(name.trim().toLowerCase(), {
    lower: true,
    strict: true,
  });
  const query: any = { slug };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const exists = await model.exists(query);
  if (exists) {
    throw new BadRequestException(message || 'name already exists');
  }

  return slug;
}
