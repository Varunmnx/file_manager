/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnlyOfficeController } from './onlyoffice.controller';
import { OnlyOfficeService } from './onlyoffice.service';
import { UploadModule } from '../file_upload_v3/file_upload_v3.module';
import { FileRevisionEntity, FileRevisionSchema } from './entities/file-revision.entity';
import { FileRevisionRepository } from './repositories/file-revision.repository';
import { AuthModule } from '../auth/auth.module';
import { CallbackAuthGuard, DownloadAuthGuard } from './guards';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    UploadModule,
    AuthModule,
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: FileRevisionEntity.name, schema: FileRevisionSchema },
    ]),
  ],
  controllers: [OnlyOfficeController],
  providers: [
    OnlyOfficeService,
    FileRevisionRepository,
    CallbackAuthGuard,
    DownloadAuthGuard,
  ],
  exports: [FileRevisionRepository, OnlyOfficeService],
})
export class OnlyOfficeModule {}

