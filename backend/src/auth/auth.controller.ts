/* eslint-disable prettier/prettier */
import { Controller, Get, Req, UseGuards, Res, Post } from '@nestjs/common';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './service/auth.service';
import { CreateUserDto } from './repository/user.repository';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private jwtService: JwtService, private authService:UsersService) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    console.log("got hit")
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req:{user:CreateUserDto}, @Res() res:Response) {
    const user = req.user;
    const token = await this.authService.login(user); 

    // Redirect to frontend with token
    return res.redirect(`http://localhost:5173/auth/google/callback?token=${token}`);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async test(@Req() req:{user:{_id:string,email:string}}) {
    const user = req.user;
    console.log("user",user);
    return req.user;
  }
}