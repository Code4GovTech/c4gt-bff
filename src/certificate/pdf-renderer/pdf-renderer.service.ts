import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import * as handlebars from 'handlebars';
import puppeteer from 'puppeteer';
import { PDFOptions, PuppeteerLaunchOptions } from 'puppeteer';

@Injectable()
export class PDFRendererService {
  private async convertPDFtoPDFArchive(inputBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const args = [
        '-dPDFA',
        '-dBATCH',
        '-dNOPAUSE',
        '-sProcessColorModel=DeviceCMYK',
        '-sDEVICE=pdfwrite',
        '-sPDFACompatibilityPolicy=1',
        '-sOutputFile=-', // Output to stdout
        '-', // Input from stdin
      ];

      const gs = spawn('gs', args);

      const chunks: Buffer[] = [];
      let errorOutput = '';

      gs.stdout.on('data', (chunk) => chunks.push(chunk));
      gs.stderr.on('data', (chunk) => (errorOutput += chunk.toString()));
      gs.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`Ghostscript failed with code ${code}: ${errorOutput}`));
        }
      });

      gs.on('error', (error) => reject(error));

      gs.stdin.write(inputBuffer);
      gs.stdin.end();
    });
  }

  compileRenderingTemplate(data: object, templateHtml: any) {
    const compiledTemplate = handlebars.compile(templateHtml);
    return compiledTemplate(data);
  }

  async renderPDF(
    compiledTemplate: string,
    pdfOptions: PDFOptions = {
      height: 848 / 0.75,
      width: 570 / 0.75,
      scale: 1 / 0.75,
      landscape: true,
      displayHeaderFooter: false,
      printBackground: true,
    },
    launchOptions: PuppeteerLaunchOptions = {
      args: ['--no-sandbox'],
      headless: 'new',
      defaultViewport: {
        width: 1024,
        height: 768,
      },
    },
    customStyleTags?: string,
  ): Promise<Buffer> {
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.setContent(compiledTemplate, { waitUntil: 'networkidle0' });
    if (customStyleTags){
      await page.addStyleTag({ content: customStyleTags });
    }
    const buffer = await page.pdf(pdfOptions);
    await browser.close();
    return await this.convertPDFtoPDFArchive(buffer);
  }
}
