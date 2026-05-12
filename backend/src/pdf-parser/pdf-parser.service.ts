import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfParserService {
  private readonly logger = new Logger(PdfParserService.name);

  async extractText(filePath: string): Promise<string> {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      // pdf-parse dynamisch importieren (CommonJS kompatibel)
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      this.logger.log(`Text extrahiert aus ${path.basename(filePath)}: ${data.text.length} Zeichen`);
      return data.text;
    } catch (error) {
      this.logger.error(`Fehler beim Lesen von PDF ${filePath}: ${error.message}`);
      throw new Error(`PDF konnte nicht gelesen werden: ${error.message}`);
    }
  }

  async getFileAsBase64(filePath: string): Promise<string> {
    const data = fs.readFileSync(filePath);
    return data.toString('base64');
  }
}
