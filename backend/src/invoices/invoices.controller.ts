import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { InvoicesService } from './invoices.service';

const uploadStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(
    @Query('vehicleId') vehicleId?: string,
    @Query('isWarehouse') isWarehouse?: string,
  ) {
    const warehouseFilter = isWarehouse !== undefined ? isWarehouse === 'true' : undefined;
    return this.invoicesService.findAll(vehicleId, warehouseFilter);
  }

  @Get('stats')
  getStats() {
    return this.invoicesService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get(':id/pdf')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const invoice = await this.invoicesService.findOne(id);
    if (!invoice.pdfPath || !fs.existsSync(invoice.pdfPath)) {
      throw new BadRequestException('PDF nicht gefunden');
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.originalFilename}"`);
    fs.createReadStream(invoice.pdfPath).pipe(res);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: uploadStorage }))
  async uploadInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Keine Datei hochgeladen');
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Nur PDF-Dateien erlaubt');
    }
    return this.invoicesService.processInvoiceFile(file.path);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.invoicesService.delete(id);
  }
}
