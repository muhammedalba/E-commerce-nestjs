import { IsMongoId, IsString } from 'class-validator';

export class IdParamDto {
  @IsMongoId({ message: 'id is not a valid ' })
  @IsString({ message: 'id must be a string' })
  id!: string;
}
