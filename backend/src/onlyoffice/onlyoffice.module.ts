import { Module } from '@nestjs/common';
import { OnlyOfficeController } from './onlyoffice.controller';
import { UploadModule } from '../file_upload_v3/file_upload_v3.module';

@Module({
  imports: [UploadModule],
  controllers: [OnlyOfficeController],
})
export class OnlyOfficeModule {}
