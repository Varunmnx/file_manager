/* eslint-disable prettier/prettier */
import { Controller, Get, Req, UseGuards, Res, Post, Body, Query } from '@nestjs/common';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './service/auth.service';
import { CreateUserDto } from './repository/user.repository';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService, private authService: UsersService, private readonly configService: ConfigService) { }
  // handles google redirection 
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth() {
    console.log("got hit")
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: { user: CreateUserDto }, @Res() res: Response) {
    const user = req.user;
    const token = await this.authService.login(user);

    // Redirect to frontend with token
    return res.redirect(`${this.configService.getOrThrow("CLIENT_BASE_URL")}/auth/google/callback?token=${token}`);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async test(@Req() req: { user: { _id: string, email: string } }) {
    const user = req.user;
    const currentUser = await this.authService.findByEmail(user.email);
    return currentUser;
  }

  @Post('signup')
  async signup(@Body() dto: CreateUserDto) {
    return this.authService.signupLocal(dto);
  }

  @Post('login')
  async login(@Body() dto: any) {
    return this.authService.loginLocal(dto);
  }

  @Get('verify')
  async verify(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Get('storage')
  @UseGuards(JwtAuthGuard)
  async getStorageInfo(@Req() req: { user: { _id: string } }) {
    return this.authService.getStorageInfo(req.user._id);
  }
}