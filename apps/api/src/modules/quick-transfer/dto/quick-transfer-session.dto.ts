import { ApiProperty } from '@nestjs/swagger';

export class QuickTransferSessionDto {
  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  mobilePath!: string;

  @ApiProperty()
  token!: string;
}

export class QuickTransferStatusDto {
  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  id!: string;

  @ApiProperty()
  uploadedCount!: number;

  @ApiProperty({ nullable: true })
  lastUploadedPhotoId!: string | null;
}

export class QuickTransferUploadResultDto {
  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  photoId!: string;
}
