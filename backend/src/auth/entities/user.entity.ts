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

  @Prop()
  lastLogin?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ googleId: 1 });
