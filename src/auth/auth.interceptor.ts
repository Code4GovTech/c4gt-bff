import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

interface AuthConfig {
  adminToken: string;
}

@Injectable()
export class AdminTokenInterceptor implements NestInterceptor {
  private config;
  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<AuthConfig>('auth');
  }
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const adminTokenHeader = request.headers['x-admin-token'];

    if (!adminTokenHeader || adminTokenHeader !== this.config.adminToken) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return next.handle();
  }
}
