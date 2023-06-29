import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { InaugurationService } from './inauguration.service';
import { Request, Response } from 'express';

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

  @Get('/verify/:did')
  async getVerifiedCert(
    @Param('did') did: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const html = await this.inaugurationService.verifyCredential(did);
    res.send(html);
  }

  @Post('/cert')
  async genCert(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    const html = await this.inaugurationService.genCert(body);
    res.send(html);
  }
}
