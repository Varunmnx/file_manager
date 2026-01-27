import { Injectable } from '@nestjs/common';
import { UserDocument } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
  googleId?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    const result = await this.userRepository.findOne({ email });
    return result;
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userRepository.findOne({ googleId });
  }

  async register(user: CreateUserDto): Promise<UserDocument> {
    return this.userRepository.create(user);
  }

  async login(user: CreateUserDto) {
    {
      let existingUser = await this.findByEmail(user.email);

      if (!existingUser) {
        existingUser = await this.register(user);
      }
      console.log(
        "existing user",
        existingUser
      )
      const userId = existingUser._id?.toString() || (existingUser as any).id?.toString();
      const payload = { email: existingUser.email, _id: userId };
      return this.jwtService.sign(payload, { secret: this.configService.getOrThrow('JWT_SECRET'), expiresIn: '1d' });
    }
  }
}
