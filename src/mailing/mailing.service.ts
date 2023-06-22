import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { Options } from 'nodemailer/lib/xoauth2';
import * as fs from 'fs';
@Injectable()
export class MailingService {
  constructor(private readonly mailerService: MailerService) {}

  private async setTransporter() {
    const OAuth2 = google.auth.OAuth2;
    const oAuth2Client = new OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET,
      'https://developers.google.com/oauthplayground',
    );

    oAuth2Client.setCredentials({
      refresh_token: process.env.REFRESH_TOKEN,
    });

    const accessToken = await new Promise((resolve, reject) => {
      oAuth2Client.getAccessToken((err, token) => {
        if (err) {
          reject('Failed to create access token :(');
        }
        resolve(token);
      });
    });

    const config: any = {
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_ID,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        accessToken,
      },
    };

    this.mailerService.addTransporter('gmail', config);
  }

  public async sendEmail(
    to: string,
    subject: string,
    html: string,
    attachment: any,
  ) {
    await this.setTransporter();

    await this.mailerService
      .sendMail({
        transporterName: 'gmail',
        to,
        from: process.env.EMAIL_ID,
        subject,
        html,
        attachments: [
          {
            // path: attachment.path,
            // path: attachment.path,
            // content: Buffer.from(attachment.path).toString('base64'),
            contentType: 'application/pdf',
            filename: attachment.filename,
            encoding: 'base64',
            content: Buffer.from(attachment.data).toString('base64'),
            contentDisposition: 'attachment',
          },
        ],
      })
      .then((success) => {
        console.log(success);
        Logger.log('email sent');
      })
      .catch((err) => {
        console.log(err);
        Logger.error(err);
      });
  }
}
