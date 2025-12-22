import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  folderName: string;

  @IsNumber()
  folderSize: number;

  @IsOptional()
  @IsString()
  parent?: string;

  @IsOptional()
  @IsString()
  children?: string[];

  @IsOptional()
  @IsString()
  fileHash?: string;
}
