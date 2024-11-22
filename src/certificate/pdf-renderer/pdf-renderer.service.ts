import { Injectable } from '@nestjs/common';
import { spawn } from 'child_process';

@Injectable()
export class PDFRendererService {
  async convertPDFtoPDFArchive(inputBuffer: Buffer): Promise<Buffer> {
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
          reject(
            new Error(`Ghostscript failed with code ${code}: ${errorOutput}`),
          );
        }
      });

      gs.on('error', (error) => reject(error));

      gs.stdin.write(inputBuffer);
      gs.stdin.end();
    });
  }

  renderPDF(){}
}
