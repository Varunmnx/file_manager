import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WopiController } from './wopi.controller';
import { WopiService } from './wopi.service';
import { UploadModule } from '../file_upload_v3/file_upload_v3.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UploadModule, ConfigModule, JwtModule],
  controllers: [WopiController],
  providers: [WopiService],
  exports: [WopiService],
})
export class WopiModule {}
