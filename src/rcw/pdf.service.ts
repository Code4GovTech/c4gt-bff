import { Injectable } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCb);

@Injectable()
export class ExecService {
  async pdfConvertorCommand(filePath, outputPath): Promise<void> {
    try {
      const { stdout, stderr } = await exec(`gs -dPDFA -dBATCH -dNOPAUSE -sProcessColorModel=DeviceCMYK -sDEVICE=pdfwrite -sPDFACompatibilityPolicy=1 -sOutputFile="${outputPath}" "${filePath}"`);
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    } catch (error) {
      console.error(`Error executing command: ${error.message}`);
    }
  }
}
