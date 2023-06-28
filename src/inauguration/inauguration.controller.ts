import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InaugurationService } from './inauguration.service';

@Controller('inauguration')
export class InaugurationController {
  constructor(private readonly inaugurationService: InaugurationService) {}

  @Post()
  generateTokens(@Body() body: any) {
    return this.inaugurationService.generateTokens(body.content);
  }

  @Get(':token')
  verifyToken(@Param('token') token: string) {
    return this.inaugurationService.verifyToken(token);
  }

  @Get('/status/:token')
  getStatus(@Param('token') token: string) {
    // Figure out how to store how many people have been inaugurated
    return this.inaugurationService.getProgress(token);
  }
}
