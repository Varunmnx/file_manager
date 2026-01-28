import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileFolderRepository } from './repositories/file-folder.repository';
import { UploadEntity, UploadSchema } from './entities/upload-status.entity';
import { UploadController } from './file_upload_v3.controller';
import { UploadPoolService } from './services/file_upload_v3.service';
import { FileRevisionEntity, FileRevisionSchema } from '../onlyoffice/entities/file-revision.entity';
import { FileRevisionRepository } from '../onlyoffice/repositories/file-revision.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadEntity.name, schema: UploadSchema },
      { name: FileRevisionEntity.name, schema: FileRevisionSchema },
    ]),
  ],
  controllers: [UploadController],
  providers: [FileFolderRepository, UploadPoolService, FileRevisionRepository],
  exports: [FileFolderRepository, UploadPoolService, FileRevisionRepository],
})
export class UploadModule {}
