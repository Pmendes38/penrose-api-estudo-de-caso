import { IsIn, IsOptional, IsString } from 'class-validator';

export class PlaceOrderDto {
  @IsString()
  draftId!: string;

  @IsOptional()
  @IsIn(['public', 'private'])
  printMode?: 'public' | 'private';
}
