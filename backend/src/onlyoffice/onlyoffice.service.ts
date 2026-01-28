import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

@Injectable()
export class OnlyOfficeService {
  private readonly jwtSecret: string;
  private readonly jwtHeader: string;
  private readonly downloadTokenSecret: string;
  private readonly downloadTokenExpiry: number = 3600; // 1 hour in seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    // OnlyOffice JWT secret - must match the secret configured in OnlyOffice container
    this.jwtSecret = this.configService.get<string>('ONLYOFFICE_JWT_SECRET') || '';
    // Header name where OnlyOffice sends the token (default: Authorization)
    this.jwtHeader = this.configService.get<string>('ONLYOFFICE_JWT_HEADER') || 'Authorization';
    // Separate secret for download URL tokens
    this.downloadTokenSecret = this.configService.get<string>('DOWNLOAD_TOKEN_SECRET') || this.jwtSecret;
  }

  /**
   * Check if JWT authentication is enabled
   */
  isJwtEnabled(): boolean {
    return !!this.jwtSecret && this.jwtSecret.length > 0;
  }

  /**
   * Sign the OnlyOffice editor configuration with JWT
   * This token is sent to the browser and used by OnlyOffice Editor
   */
  signConfig(config: any): string {
    if (!this.isJwtEnabled()) {
      return '';
    }

    // Use JwtService to sign with specific secret
    return this.jwtService.sign(config, {
      secret: this.jwtSecret,
      algorithm: 'HS256',
      expiresIn: '24h',
    });
  }

  /**
   * Verify and decode a JWT token from OnlyOffice callback
   * Returns the decoded payload if valid, throws error if invalid
   */
  verifyCallbackToken(token: string): any {
    if (!this.isJwtEnabled()) {
      throw new Error('JWT is not enabled');
    }

    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      
      // Use JwtService to verify
      return this.jwtService.verify(cleanToken, { 
        secret: this.jwtSecret,
        algorithms: ['HS256'] 
      });
    } catch (error) {
      throw new Error(`Invalid callback token: ${error.message}`);
    }
  }

  /**
   * Extract JWT token from request headers
   * OnlyOffice can send the token in different headers based on configuration
   */
  extractTokenFromHeaders(headers: Record<string, any>): string | null {
    // Check the configured header (case-insensitive)
    const headerName = this.jwtHeader.toLowerCase();
    const token = headers[headerName] || headers['authorization'];
    
    if (!token) {
      return null;
    }

    // Handle 'Bearer <token>' format
    if (typeof token === 'string' && token.startsWith('Bearer ')) {
      return token.slice(7);
    }

    return token;
  }

  /**
   * Verify the callback request body contains a valid token
   * OnlyOffice includes the token in the body when JWT is enabled
   */
  verifyCallbackBody(body: any): { valid: boolean; payload?: any; error?: string } {
    if (!this.isJwtEnabled()) {
      // If JWT is disabled, accept all callbacks (not recommended for production)
      return { valid: true, payload: body };
    }

    // OnlyOffice includes the token in the body.token field
    const token = body.token;
    if (!token) {
      return { valid: false, error: 'No token found in callback body' };
    }

    try {
      const decoded = this.verifyCallbackToken(token);
      // The decoded payload contains the original callback data
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Generate a signed download token for secure file access
   * This creates a time-limited token that must be included in download URLs
   */
  generateDownloadToken(fileId: string, version?: number): string {
    const payload = {
      fileId,
      version: version || 'current',
      // 'exp' is handled by jwtService options, but we can set specific fields
      type: 'download',
    };

    return this.jwtService.sign(payload, { 
      secret: this.downloadTokenSecret,
      algorithm: 'HS256',
      expiresIn: this.downloadTokenExpiry // Use seconds or string format like '1h'
    });
  }

  /**
   * Verify a download token and return the file info
   */
  verifyDownloadToken(token: string): { fileId: string; version?: number } | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.downloadTokenSecret,
        algorithms: ['HS256'],
      }) as any;

      if (decoded.type !== 'download') {
        return null;
      }

      return {
        fileId: decoded.fileId,
        version: decoded.version === 'current' ? undefined : decoded.version,
      };
    } catch (error) {
      console.error('[OnlyOffice] Download token verification failed:', error.message);
      return null;
    }
  }

  /**
   * Generate a callback signature for verification
   * This is an additional layer of security using HMAC
   */
  generateCallbackSignature(callbackUrl: string): string {
    if (!this.isJwtEnabled()) {
      return '';
    }

    const timestamp = Date.now();
    const data = `${callbackUrl}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(data)
      .digest('hex');

    return `${timestamp}:${signature}`;
  }

  /**
   * Get the JWT secret for debugging (masked)
   */
  getJwtStatus(): { enabled: boolean; secretMask: string } {
    return {
      enabled: this.isJwtEnabled(),
      secretMask: this.jwtSecret 
        ? `${this.jwtSecret.substring(0, 4)}${'*'.repeat(Math.max(0, this.jwtSecret.length - 4))}`
        : 'NOT SET',
    };
  }
}
