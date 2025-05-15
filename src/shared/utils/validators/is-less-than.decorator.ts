import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsLessThan(
  relatedProperty: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLessThan',
      target: object.constructor,
      propertyName,
      constraints: [relatedProperty],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as string[];
          let relatedValue: unknown = undefined;
          if (
            args.object &&
            typeof args.object === 'object' &&
            relatedPropertyName in args.object
          ) {
            relatedValue = (args.object as Record<string, unknown>)[
              relatedPropertyName
            ];
          }
          if (value == null || relatedValue == null) return true;
          return (
            typeof value === 'number' &&
            typeof relatedValue === 'number' &&
            value < relatedValue
          );
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedPropertyName] = args.constraints as string[];
          return `${args.property} must be less than ${relatedPropertyName}`;
        },
      },
    });
  };
}
