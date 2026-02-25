import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Share, ShareSchema } from './entities/share.entity';
import { ShareRepository } from './repositories/share.repository';
import { ShareService } from './services/share.service';
import { ShareController } from './controllers/share.controller';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../file_upload_v3/file_upload_v3.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Share.name, schema: ShareSchema }]),
        AuthModule,
        UploadModule,
    ],
    controllers: [ShareController],
    providers: [ShareRepository, ShareService],
    exports: [ShareService, ShareRepository],
})
export class ShareModule { }
