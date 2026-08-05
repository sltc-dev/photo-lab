import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveEditedPhotoDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  finalize = false;

  @IsOptional()
  @IsString()
  @MaxLength(512 * 1024)
  editState?: string;
}
