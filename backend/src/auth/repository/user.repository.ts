import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../entities/user.entity';
import { EntityRepository } from 'src/db/entity-repository';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  googleId?: string;
  accessToken?: string;
  refreshToken?: string;
  password?: string;
}

@Injectable()
export class UserRepository extends EntityRepository<UserDocument> {
  constructor(@InjectModel(User.name) uploadEntity: Model<UserDocument>) {
    super(uploadEntity);
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email });
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.findOne({ googleId });
  }

  async findByVerificationToken(token: string): Promise<UserDocument | null> {
    return this.findOne({ verificationToken: token });
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.findOne({ _id: id });
  }
}
