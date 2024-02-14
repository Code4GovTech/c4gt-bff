import { Injectable, Logger } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

@Injectable()
export class ExecService {
  private readonly logger = new Logger(ExecService.name);

  async pdfConvertorCommand(filePath, outputPath): Promise<void> {
    try {
      const { stdout, stderr } = await exec(`gs -dPDFA -dBATCH -dNOPAUSE -sProcessColorModel=DeviceCMYK -sDEVICE=pdfwrite -sPDFACompatibilityPolicy=1 -sOutputFile="${outputPath}" "${filePath}"`);
      this.logger.log(`Converting PDF (stdout): ${stdout}`);
      this.logger.log(`Converting PDF (stderr): ${stderr}`);
    } catch (error) {
      this.logger.error(`Error Converting PDF: ${error.message}`);
    }
  }
}
