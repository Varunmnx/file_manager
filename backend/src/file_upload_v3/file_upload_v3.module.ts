import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FileFolderRepository } from './repositories/file-folder.repository';
import { UploadEntity, UploadSchema } from './entities/upload-status.entity';
import { UploadController } from './file_upload_v3.controller';
import { UploadPoolService } from './services/file_upload_v3.service';
import { FileRevisionEntity, FileRevisionSchema } from '../onlyoffice/entities/file-revision.entity';
import { FileRevisionRepository } from '../onlyoffice/repositories/file-revision.repository';
import { Activity, ActivitySchema } from './entities/activity.entity';
import { ActivityRepository } from './repositories/activity.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UploadEntity.name, schema: UploadSchema },
      { name: FileRevisionEntity.name, schema: FileRevisionSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [UploadController],
  providers: [FileFolderRepository, UploadPoolService, FileRevisionRepository, ActivityRepository],
  exports: [FileFolderRepository, UploadPoolService, FileRevisionRepository, ActivityRepository],
})
export class UploadModule { }
