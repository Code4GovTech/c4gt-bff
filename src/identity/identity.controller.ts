import { Controller, Post, Get, Param, UseInterceptors } from '@nestjs/common';
import { AdminTokenInterceptor } from 'src/auth/auth.interceptor';
import { IdentityService } from './identity.service';

@Controller('identity')
@UseInterceptors(AdminTokenInterceptor)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('generate')
  async generateIdentity() {
    return this.identityService.generateIdentity();
  }

  @Get('resolve/:did')
  async resolveIdentity(@Param('did') did: string) {
    return this.identityService.resolveIdentity(did);
  }
}
