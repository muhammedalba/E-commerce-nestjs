import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@ValidatorConstraint({ name: 'Exists', async: true })
@Injectable()
export class ExistsConstraint implements ValidatorConstraintInterface {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async validate(value: any, args: ValidationArguments) {
    const [modelName] = args.constraints;
    if (!value || !modelName) return true;

    try {
      const model = this.connection.model(modelName);
      
      // Handle array or single value and remove duplicates
      const rawIds = Array.isArray(value) ? value : [value];
      const uniqueIds = [...new Set(rawIds.filter((id) => id && typeof id === 'string'))];

      if (uniqueIds.length === 0) return true;

      const count = await model.countDocuments({ _id: { $in: uniqueIds } });
      
      // Must find exactly as many unique IDs as provided
      return count === uniqueIds.length;
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

export function Exists(modelName: string, validationOptions?: ValidationOptions) {
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
