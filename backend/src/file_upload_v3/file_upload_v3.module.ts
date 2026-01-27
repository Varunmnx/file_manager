import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileFolderRepository } from './repositories/file-folder.repository';
import { UploadEntity, UploadSchema } from './entities/upload-status.entity';
import { UploadController } from './file_upload_v3.controller';
import { UploadPoolService } from './services/file_upload_v3.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: UploadEntity.name, schema: UploadSchema }])],
  controllers: [UploadController],
  providers: [FileFolderRepository, UploadPoolService],
  exports: [FileFolderRepository, UploadPoolService],
})
export class UploadModule {}
