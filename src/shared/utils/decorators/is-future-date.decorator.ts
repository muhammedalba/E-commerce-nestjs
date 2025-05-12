import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return value instanceof Date && value.getTime() > Date.now();
        },
        defaultMessage() {
          return 'Date must be in the future';
        },
      },
    });
  };
}
