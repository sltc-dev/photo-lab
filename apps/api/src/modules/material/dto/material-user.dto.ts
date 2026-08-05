import { ApiProperty } from '@nestjs/swagger';

//定义用户返回字段
export class MaterialUserDto {
  @ApiProperty({
    description: '用户id',
    type: String,
  })
  id!: string;

  @ApiProperty({
    description: '用户名',
    type: String,
  })
  userName!: string;

  @ApiProperty({
    description: '用户拥有图库数量',
    example: 3,
    minimum: 0,
    type: Number,
  })
  projectCount!: number;
}
