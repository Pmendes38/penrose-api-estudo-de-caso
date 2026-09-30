import { IsString } from 'class-validator';

export class GetDraftParamDto {
  @IsString()
  id!: string;
}
