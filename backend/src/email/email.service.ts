import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: Number(this.configService.get('SMTP_PORT')),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const url = `${this.configService.get('CLIENT_BASE_URL')}/verify-email?token=${token}`;
    
    await this.transporter.sendMail({
      from: '"VF Manager" <no-reply@vfmanager.com>',
      to: email,
      subject: 'Verify your email',
      html: `
        <h1>Welcome!</h1>
        <p>Please click the link below to verify your account:</p>
        <a href="${url}">Verify Email</a>
      `,
    });
  }
}
