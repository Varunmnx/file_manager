import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.stratergy';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { UsersService } from './service/auth.service';
import { UserRepository } from './repository/user.repository';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.stratergy';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [AuthController],
  providers: [GoogleStrategy, UsersService, UserRepository, JwtService, JwtStrategy],
})
export class AuthModule {}
