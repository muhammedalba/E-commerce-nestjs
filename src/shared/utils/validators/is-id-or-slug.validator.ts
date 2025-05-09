import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsIdOrSlug', async: false })
export class IsIdOrSlugConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    const trimmed = value.trim();
    // MongoDB ObjectId: 24-character hex string
    const isMongoId = /^[a-f\d]{24}$/i.test(trimmed);

    // Slug: Arabic and Latin letters, numbers, and hyphens
    const isSlug =
      /^[\u0621-\u064Aa-zA-Z0-9]+(?:-[\u0621-\u064Aa-zA-Z0-9]+)*$/.test(
        trimmed,
      );

    return isMongoId || isSlug;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid Mongo ID or a slug (Arabic and Latin letters allowed)`;
  }
}
