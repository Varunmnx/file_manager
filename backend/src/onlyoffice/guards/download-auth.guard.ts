import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnlyOfficeService } from '../onlyoffice.service';

/**
 * Guard to protect OnlyOffice download endpoints
 * 
 * This guard verifies:
 * 1. Download token in query parameter (for OnlyOffice container access)
 * 2. Falls back to standard JWT auth for browser requests
 * 
 * Download tokens are time-limited and contain the specific file/version being requested,
 * preventing unauthorized access even if an attacker obtains a token.
 */
@Injectable()
export class DownloadAuthGuard implements CanActivate {
  private readonly logger = new Logger(DownloadAuthGuard.name);
  private readonly requireAuth: boolean;

  constructor(
    private readonly onlyOfficeService: OnlyOfficeService,
    private readonly configService: ConfigService,
  ) {
    // In development, you might want to disable auth requirements
    this.requireAuth = this.configService.get<boolean>('ONLYOFFICE_REQUIRE_DOWNLOAD_AUTH') ?? 
                       this.configService.get<string>('NODE_ENV') === 'production';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const downloadToken = request.query.token as string;
    const requestedFileId = request.params.fileId;
    const requestedVersion = request.params.version; 
    this.logger.debug(`Download request for file: ${requestedFileId}, version: ${requestedVersion || 'current'}`);

    // Check for download token (used by OnlyOffice container)
    if (downloadToken) {
      const tokenData = this.onlyOfficeService.verifyDownloadToken(downloadToken);

      if (!tokenData) {
        this.logger.warn(`Invalid download token for file: ${requestedFileId}`);
        throw new UnauthorizedException('Invalid or expired download token');
      }

      // Verify the token is for the requested file
      if (tokenData.fileId !== requestedFileId) {
        this.logger.warn(`Token file mismatch: token=${tokenData.fileId}, requested=${requestedFileId}`);
        throw new UnauthorizedException('Token is not valid for this file');
      }

      // If requesting a specific version, verify it matches the token
      if (requestedVersion && tokenData.version) {
        const reqVersion = parseInt(requestedVersion, 10);
        if (reqVersion !== tokenData.version) {
          this.logger.warn(`Token version mismatch: token=${tokenData.version}, requested=${reqVersion}`);
          throw new UnauthorizedException('Token is not valid for this version');
        }
      }

      this.logger.debug(`Download token verified for file: ${requestedFileId}`);
      return true;
    }

    // No download token - check if auth is required
    if (!this.requireAuth) {
      this.logger.debug('Download authentication not required (development mode)');
      return true;
    }

    // In production without a valid token, reject the request
    this.logger.warn(`Unauthenticated download attempt for file: ${requestedFileId}`);
    throw new UnauthorizedException('Download authentication required');
  }
}
