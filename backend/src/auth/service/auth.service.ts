import { Injectable, ConflictException, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { User, UserDocument } from '../entities/user.entity';
import { UserRepository } from '../repository/user.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { EmailService } from 'src/email/email.service';

const MAX_USERS = 20;
const MAX_STORAGE_BYTES = 350 * 1024 * 1024; // 350 MB

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
  ) { }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userRepository.findById(id);
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userRepository.findByGoogleId(googleId);
  }

  async register(user: CreateUserDto): Promise<UserDocument> {
    // Check user count limit
    const count = await this.userRepository.countAll();
    if (count >= MAX_USERS) {
      throw new ForbiddenException(`Maximum of ${MAX_USERS} users allowed. Registration is closed.`);
    }

    // Google users are automatically verified
    const userBuilder = User.builder()
      .setEmail(user.email)
      .setFirstName(user.firstName)
      .setLastName(user.lastName)
      .setIsVerified(true)
      .setStorageUsed(0)
      .setStorageLimit(MAX_STORAGE_BYTES);

    if (user.picture) userBuilder.setPicture(user.picture);
    if (user.googleId) userBuilder.setGoogleId(user.googleId);
    if (user.accessToken) userBuilder.setAccessToken(user.accessToken);
    if (user.refreshToken) userBuilder.setRefreshToken(user.refreshToken);
    if (user.password) userBuilder.setPassword(user.password);

    return this.userRepository.create(userBuilder.build());
  }

  async login(user: CreateUserDto) {
    let existingUser = await this.findByEmail(user.email);

    if (!existingUser) {
      existingUser = await this.register(user);
    } else {
      // Link Google ID and verify email if matched by email
      let updated = false;
      const builder = existingUser.toBuilder();

      if (!existingUser.googleId && user.googleId) {
        builder.setGoogleId(user.googleId);
        updated = true;
      }

      if (!existingUser.isVerified) {
        builder.setIsVerified(true);
        builder.setVerificationToken(undefined);
        updated = true;
      }

      if (updated) {
        const updatedUser = builder.build();
        existingUser = await this.userRepository.findOneAndUpdate(
          { _id: existingUser._id },
          { $set: updatedUser }
        ) as UserDocument;
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
    // Check user count limit
    const count = await this.userRepository.countAll();
    if (count >= MAX_USERS) {
      throw new ForbiddenException(`Maximum of ${MAX_USERS} users allowed. Registration is closed.`);
    }

    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    if (!dto.password) {
      throw new ConflictException('Password is required');
    }

    const hashedPassword = this.hashPassword(dto.password);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const userBuilder = User.builder()
      .setEmail(dto.email)
      .setFirstName(dto.firstName)
      .setLastName(dto.lastName)
      .setPassword(hashedPassword)
      .setProvider('local')
      .setIsVerified(false)
      .setVerificationToken(verificationToken);

    if (dto.picture) userBuilder.setPicture(dto.picture);

    const newUser = await this.userRepository.create(userBuilder.build());

    await this.emailService.sendVerificationEmail(newUser.email, verificationToken);
    return newUser;
  }

  // --- Storage Quota ---

  async checkStorageQuota(userId: string, additionalBytes: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const limit = user.storageLimit || MAX_STORAGE_BYTES;
    if ((user.storageUsed || 0) + additionalBytes > limit) {
      const usedMB = ((user.storageUsed || 0) / (1024 * 1024)).toFixed(1);
      const limitMB = (limit / (1024 * 1024)).toFixed(0);
      throw new ForbiddenException(`Storage limit exceeded. Used: ${usedMB}MB / ${limitMB}MB`);
    }
  }

  async updateStorageUsed(userId: string, deltaBytes: number): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) return;
    const newUsed = Math.max(0, (user.storageUsed || 0) + deltaBytes);
    await this.userRepository.findOneAndUpdate({ _id: user._id }, { $set: { storageUsed: newUsed } });
  }

  async getStorageInfo(userId: string): Promise<{ storageUsed: number; storageLimit: number }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new BadRequestException('User not found');
    return {
      storageUsed: user.storageUsed || 0,
      storageLimit: user.storageLimit || MAX_STORAGE_BYTES,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.userRepository.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    const builder = user.toBuilder()
      .setIsVerified(true)
      .setVerificationToken(undefined);

    await this.userRepository.findOneAndUpdate({ _id: user._id }, { $set: builder.build() });
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
