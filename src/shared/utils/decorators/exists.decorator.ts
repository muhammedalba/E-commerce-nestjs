import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@ValidatorConstraint({ name: 'Exists', async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async validate(value: any, args: ValidationArguments) {
    const [modelName] = args.constraints;
    if (!value || !modelName) return true;

    try {
      const model = this.connection.model(modelName);

      // Unique IDs
      const rawIds = Array.isArray(value) ? value : [value];
      const uniqueIds = [
        ...new Set(rawIds.filter((id) => id && typeof id === 'string')),
      ];

      if (uniqueIds.length === 0) return true;

      // Check cache for each ID
      const results = await Promise.all(
        uniqueIds.map(async (id) => {
          const cacheKey = `exists:${modelName.toLowerCase().trim()}:${id}`;
          const cached = await this.cacheManager.get<boolean>(cacheKey);

          if (cached !== undefined) {
            return { id, exists: cached, fromCache: true };
          }
          return { id, exists: null, fromCache: false };
        }),
      );

      const unknownIds = results.filter((r) => !r.fromCache).map((r) => r.id);

      if (unknownIds.length > 0) {
        const foundDocs = await model
          .find({ _id: { $in: unknownIds } })
          .select('_id')
          .lean<{ _id: string }[]>();
        const foundIds = new Set(foundDocs.map((d) => d._id.toString().trim()));

        // Update cache for unknown IDs
        await Promise.all(
          unknownIds.map(async (id) => {
            const exists = foundIds.has(id);
            const cacheKey = `exists:${modelName.toLowerCase()}:${id}`;
            await this.cacheManager.set(cacheKey, exists, 300000); // 5 minutes TTL

            // Update results for return check
            const res = results.find((r) => r.id === id);
            if (res) res.exists = exists;
          }),
        );
      }

      // Final check: all uniqueIds must exist
      return results.every((r) => r.exists === true);
    } catch (error: any) {
      console.error(`ExistsConstraint Error: ${error.message}`);
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    const [modelName] = args.constraints;
    return `${args.property} contains invalid ${modelName} IDs or some IDs do not exist.`;
  }
}

export function Exists(
  modelName: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [modelName],
      validator: ExistsConstraint,
    });
  };
}
