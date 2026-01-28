import { IsString, IsOptional } from 'class-validator';

export class CreateFileDto {
  @IsString()
  fileName: string;

  @IsOptional()
  @IsString()
  parent?: string;
}
