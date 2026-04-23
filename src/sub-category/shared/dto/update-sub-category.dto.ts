import { PartialType } from '@nestjs/mapped-types';
import { CreateSupCategoryDto } from './create-sup-category.dto';

export class UpdateSupCategoryDto extends PartialType(CreateSupCategoryDto) {}
