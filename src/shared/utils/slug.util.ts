import slugify from 'slugify';
import { Model } from 'mongoose';

export async function generateUniqueSlug(
  name: string,

  model: Model<any>,
  counter = 0,
): Promise<string> {
  const baseSlug = slugify(name, { lower: true, strict: true });
  const slug = counter ? `${baseSlug}-${counter}` : baseSlug;

  const exists = await model.exists({ slug });
  if (exists) {
    return generateUniqueSlug(name, model, counter + 1);
  }

  return slug;
}
