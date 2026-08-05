import { ApiProperty } from '@nestjs/swagger';
import { PhotoDto } from './photo.dto';

export class PhotoPageDto {
  @ApiProperty({
    isArray: true,
    type: PhotoDto,
  })
  items!: PhotoDto[];

  @ApiProperty({
    description: '下一页游标；没有更多数据时为 null',
    nullable: true,
    type: String,
  })
  nextCursor!: string | null;
}
