import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RcwModule } from './rcw/rcw.module';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailingModule } from './mailing/mailing.module';
import { MinioModule } from './minio/minio.module';
import { InaugurationService } from './inauguration/inauguration.service';
import { InaugurationModule } from './inauguration/inauguration.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MailerModule.forRoot({
      transport: `smtps://${process.env.EMAIL_ID}:${process.env.EMAIL_PASS}@smtp.${process.env.DOMAIN}.com`,
      //{
      //   host: 'smtp.gmail.com',
      //   port: 465,
      //   secure: true,
      //   auth: {
      //     type: 'OAuth2',
      //     user: process.env.EMAIL_ID,
      //     clientId: process.env.CLIENT_ID,
      //     clientSecret: process.env.CLIENT_SECRET,
      //     refreshToken: process.env.REFRESH_TOKEN,
      //     accessToken: process.env.ACCESS_TOKEN,
      //   },
      // }, // `smtps://${process.env.EMAIL_ID}:${process.env.EMAIL_PASS}@smtp.${process.env.DOMAIN}.com`,
      defaults: {
        from: `"${process.env.MAILING_NAME}" <${process.env.EMAIL_ID}>`,
      },
      preview: true,
    }),
    RcwModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MailingModule,
    MinioModule,
    InaugurationModule,
    HttpModule,
  ],
  controllers: [AppController],
  providers: [AppService, InaugurationService],
})
export class AppModule {}
