import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { IdentityService } from './identity.service';

@Controller('identity')
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
