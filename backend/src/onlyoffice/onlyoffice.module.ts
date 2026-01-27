/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnlyOfficeController } from './onlyoffice.controller';
import { UploadModule } from '../file_upload_v3/file_upload_v3.module';
import { FileRevisionEntity, FileRevisionSchema } from './entities/file-revision.entity';
import { FileRevisionRepository } from './repositories/file-revision.repository';

@Module({
  imports: [
    UploadModule,
    MongooseModule.forFeature([
      { name: FileRevisionEntity.name, schema: FileRevisionSchema },
    ]),
  ],
  controllers: [OnlyOfficeController],
  providers: [FileRevisionRepository],
  exports: [FileRevisionRepository],
})
export class OnlyOfficeModule {}
