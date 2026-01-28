import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnlyOfficeService } from '../onlyoffice.service';

/**
 * Guard to protect OnlyOffice callback endpoints
 * 
 * This guard verifies:
 * 1. JWT token in the callback body (when JWT is enabled in OnlyOffice)
 * 2. Optional IP whitelist check for the OnlyOffice container
 * 
 * Industry-standard protection for document editor callbacks:
 * - JWT signature verification prevents forged callbacks
 * - IP whitelisting provides defense in depth
 */
@Injectable()
export class CallbackAuthGuard implements CanActivate {
  private readonly logger = new Logger(CallbackAuthGuard.name);
  private readonly allowedIps: string[];
  private readonly strictMode: boolean;

  constructor(
    private readonly onlyOfficeService: OnlyOfficeService,
    private readonly configService: ConfigService,
  ) {
    // Allowed IPs for callbacks (OnlyOffice container IP)
    // Default includes Docker internal addresses and localhost
    const configuredIps = this.configService.get<string>('ONLYOFFICE_ALLOWED_IPS') || '';
    this.allowedIps = configuredIps
      ? configuredIps.split(',').map(ip => ip.trim())
      : [
          '127.0.0.1',
          '::1',
          'localhost',
          '172.17.0.1',  // Docker bridge network
          '172.18.0.1',
          'host.docker.internal',
        ];

    // Strict mode requires both JWT and IP validation
    this.strictMode = this.configService.get<boolean>('ONLYOFFICE_STRICT_MODE') ?? false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const body = request.body;
    const clientIp = this.extractClientIp(request);

    this.logger.debug(`Callback request from IP: ${clientIp}`);

    // Check if JWT is enabled
    const jwtEnabled = this.onlyOfficeService.isJwtEnabled();
    console.log("isJwtEnabled", jwtEnabled);
    if (jwtEnabled) {
      // Verify JWT token in callback body
      const verification = this.onlyOfficeService.verifyCallbackBody(body);

      if (!verification.valid) {
        this.logger.warn(`Invalid callback token from ${clientIp}: ${verification.error}`);
        throw new UnauthorizedException(`Invalid callback authentication: ${verification.error}`);
      }

      // Replace body with decoded payload (contains the actual callback data)
      if (verification.payload) {
        // The decoded JWT contains a 'payload' field with the original callback data
        // OnlyOffice wraps the callback data when signing
        request.body = verification.payload.payload || verification.payload;
      }

      this.logger.debug(`Callback token verified successfully for IP: ${clientIp}`);
    } else {
      // JWT is disabled - warn in logs
      this.logger.warn('JWT is disabled! Callback authentication is not enforced. This is insecure for production.');

      // In strict mode, still require JWT even if disabled
      if (this.strictMode) {
        throw new UnauthorizedException('JWT authentication is required in strict mode');
      }
    }

    // IP whitelist check (optional additional security layer)
    const ipCheckEnabled = this.configService.get<boolean>('ONLYOFFICE_IP_CHECK') ?? false;

    if (ipCheckEnabled) {
      const isAllowedIp = this.isIpAllowed(clientIp);

      if (!isAllowedIp) {
        this.logger.warn(`Callback from unauthorized IP: ${clientIp}`);
        throw new UnauthorizedException('Callback not allowed from this IP address');
      }

      this.logger.debug(`IP whitelist check passed for: ${clientIp}`);
    }

    return true;
  }

  /**
   * Extract the client IP from the request
   * Handles X-Forwarded-For header for proxied requests
   */
  private extractClientIp(request: any): string {
    // Check X-Forwarded-For header (for reverse proxy setups)
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, the first is the original client
      const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return request.connection?.remoteAddress || 
           request.socket?.remoteAddress || 
           request.ip || 
           'unknown';
  }

  /**
   * Check if the IP is in the allowed list
   */
  private isIpAllowed(clientIp: string): boolean {
    // Normalize IPv6 mapped IPv4 addresses
    const normalizedIp = clientIp
      .replace(/^::ffff:/, '')
      .toLowerCase();

    return this.allowedIps.some(allowedIp => {
      const normalizedAllowed = allowedIp.toLowerCase();
      
      // Exact match
      if (normalizedIp === normalizedAllowed) {
        return true;
      }

      // Check for CIDR notation (basic support)
      if (allowedIp.includes('/')) {
        return this.isIpInCidr(normalizedIp, allowedIp);
      }

      // Check if IP starts with allowed prefix (for Docker networks)
      if (normalizedIp.startsWith(normalizedAllowed)) {
        return true;
      }

      return false;
    });
  }

  /**
   * Basic CIDR check (supports common cases)
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const maskBits = parseInt(bits, 10);
    
    if (isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
      return false;
    }

    // Simple prefix matching for common cases
    const prefix = range.split('.').slice(0, Math.floor(maskBits / 8)).join('.');
    return ip.startsWith(prefix);
  }
}
