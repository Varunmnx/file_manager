import { Injectable, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { UserDocument } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EmailService } from 'src/email/email.service';

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
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    const result = await this.userRepository.findOne({ email });
    return result;
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userRepository.findOne({ googleId });
  }

  async register(user: CreateUserDto): Promise<UserDocument> {
    // Google users are automatically verified
    const userWithVerification = { ...user, isVerified: true };
    return this.userRepository.create(userWithVerification);
  }

  async login(user: CreateUserDto) {
      let existingUser = await this.findByEmail(user.email);

      if (!existingUser) {
        existingUser = await this.register(user);
      } else {
        // Link Google ID and verify email if matched by email
        let updated = false;
        
        if (!existingUser.googleId && user.googleId) {
            existingUser.googleId = user.googleId;
            updated = true;
        }
        
        if (!existingUser.isVerified) {
            existingUser.isVerified = true;
            existingUser.verificationToken = undefined;
            updated = true;
        }

        if (updated) {
            await existingUser.save();
        }
      }
      return this.generateToken(existingUser);
  }

  private generateToken(user: UserDocument | any) {
      const userId = user._id?.toString() || (user as any).id?.toString();
      const payload = { email: user.email, _id: userId };
      return this.jwtService.sign(payload, { secret: this.configService.getOrThrow('JWT_SECRET'), expiresIn: '1d' });
  }

  // --- Local Auth ---

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, originalHash] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === originalHash;
  }

  async signupLocal(dto: CreateUserDto) {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    if (!dto.password) {
      throw new ConflictException('Password is required');
    }

    const hashedPassword = this.hashPassword(dto.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    const newUser = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
      provider: 'local',
      picture: dto.picture || '',
      isVerified: false,
      verificationToken,
    });

    await this.emailService.sendVerificationEmail(newUser.email, verificationToken);
    return newUser;
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findOne({ verificationToken: token });
    if (!user) {
        throw new BadRequestException('Invalid verification token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    return { message: 'Email verified successfully' };
  }

  async loginLocal(dto: { email: string; password: string }) {
    const user = await this.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password && user.provider === 'google') {
       throw new UnauthorizedException('Please login with Google');
    }

    if (!user.password) {
       throw new UnauthorizedException('Invalid credentials (no password set)');
    }

    const isValid = this.verifyPassword(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
        throw new UnauthorizedException('Please verify your email first');
    }

    return {
       token: this.generateToken(user),
       user: {
         email: user.email,
         firstName: user.firstName,
         lastName: user.lastName,
         picture: user.picture,
         _id: user._id
       }
    };
  }
}
