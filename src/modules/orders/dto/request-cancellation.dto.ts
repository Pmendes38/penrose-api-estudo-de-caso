import { IsString, Length } from 'class-validator';

export class RequestCancellationDto {
  @IsString()
  @Length(1, 500)
  reason!: string;
}
