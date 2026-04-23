import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { CreateUserDto } from '../dto/create-user.dto';
import { i18nValidationMessage } from 'nestjs-i18n';

@ValidatorConstraint({ name: 'MatchPassword', async: false })
export class MatchPasswordValidator implements ValidatorConstraintInterface {
  validate(password: string, args: ValidationArguments): boolean {
    const object = args.object as CreateUserDto;

    if (!object.confirmPassword) {
      return false;
    }
    if (!object.password) {
      return false;
    }

    return (
      password.toString().trim() === object.confirmPassword.toString().trim()
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return i18nValidationMessage('validation.MATCH_PASSWORD')(args);
  }
}
