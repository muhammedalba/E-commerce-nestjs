import { IsMongoId } from 'class-validator';

export class IdParamDto {
  @IsMongoId({ message: 'id is not a valid ' })
  id!: string;
}
