import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop()
  picture?: string;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  password?: string;


  @Prop()
  accessToken?: string;

  @Prop()
  refreshToken?: string;

  @Prop({ default: 'google' })
  provider: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop()
  verificationToken?: string;

  @Prop()
  lastLogin?: Date;

  @Prop({ default: 0 })
  storageUsed: number;

  @Prop({ default: 350 * 1024 * 1024 }) // 350 MB
  storageLimit: number;

  public static builder() {
    return new User.Builder();
  }

  public toBuilder() {
    const builder = User.builder();
    builder.email = this.email;
    builder.firstName = this.firstName;
    builder.lastName = this.lastName;
    builder.picture = this.picture;
    builder.googleId = this.googleId;
    builder.password = this.password;
    builder.accessToken = this.accessToken;
    builder.refreshToken = this.refreshToken;
    builder.provider = this.provider;
    builder.isActive = this.isActive;
    builder.isVerified = this.isVerified;
    builder.verificationToken = this.verificationToken;
    builder.lastLogin = this.lastLogin;
    builder.storageUsed = this.storageUsed;
    builder.storageLimit = this.storageLimit;
    return builder;
  }

  public static Builder = class {
    email: string;
    firstName: string;
    lastName: string;
    picture?: string;
    googleId?: string;
    password?: string;
    accessToken?: string;
    refreshToken?: string;
    provider = 'google';
    isActive = true;
    isVerified = false;
    verificationToken?: string;
    lastLogin?: Date;
    storageUsed = 0;
    storageLimit = 350 * 1024 * 1024;

    public setEmail(value: string) {
      this.email = value;
      return this;
    }

    public setFirstName(value: string) {
      this.firstName = value;
      return this;
    }

    public setLastName(value: string) {
      this.lastName = value;
      return this;
    }

    public setPicture(value: string | undefined) {
      this.picture = value;
      return this;
    }

    public setGoogleId(value: string | undefined) {
      this.googleId = value;
      return this;
    }

    public setPassword(value: string | undefined) {
      this.password = value;
      return this;
    }

    public setAccessToken(value: string | undefined) {
      this.accessToken = value;
      return this;
    }

    public setRefreshToken(value: string | undefined) {
      this.refreshToken = value;
      return this;
    }

    public setProvider(value: string) {
      this.provider = value;
      return this;
    }

    public setIsActive(value: boolean) {
      this.isActive = value;
      return this;
    }

    public setIsVerified(value: boolean) {
      this.isVerified = value;
      return this;
    }

    public setVerificationToken(value: string | undefined) {
      this.verificationToken = value;
      return this;
    }

    public setLastLogin(value: Date | undefined) {
      this.lastLogin = value;
      return this;
    }

    public setStorageUsed(value: number) {
      this.storageUsed = value;
      return this;
    }

    public setStorageLimit(value: number) {
      this.storageLimit = value;
      return this;
    }

    public build(): User {
      const e = new User();
      e.email = this.email;
      e.firstName = this.firstName;
      e.lastName = this.lastName;
      e.picture = this.picture;
      e.googleId = this.googleId;
      e.password = this.password;
      e.accessToken = this.accessToken;
      e.refreshToken = this.refreshToken;
      e.provider = this.provider;
      e.isActive = this.isActive;
      e.isVerified = this.isVerified;
      e.verificationToken = this.verificationToken;
      e.lastLogin = this.lastLogin;
      e.storageUsed = this.storageUsed;
      e.storageLimit = this.storageLimit;
      return e;
    }
  };
}

export const UserSchema = SchemaFactory.createForClass(User);

// Note: email and googleId already have indexes via `unique: true` in @Prop decorator
UserSchema.loadClass(User);
