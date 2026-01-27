/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configure raw body parser for WOPI file upload endpoint (must be before other body parsers)
  // Use regex to match /wopi/files/{any-id}/contents
  app.use(/^\/wopi\/files\/[^/]+\/contents$/, express.raw({ type: '*/*', limit: '50mb' }));
  
  app.enableCors({
    origin: "*", // or array of allowed origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: '*', // Allow all headers including x-wopi-lock, x-wopi-override, etc.
    credentials: true,
    exposedHeaders: '*',
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
