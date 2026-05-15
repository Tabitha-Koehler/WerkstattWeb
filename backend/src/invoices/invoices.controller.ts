import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { InvoicesService } from './invoices.service';
import { AiAnalysisService } from '../ai-analysis/ai-analysis.service';

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
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

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

  @Get('reprocess/status')
  getReprocessStatus() {
    return this.invoicesService.getReprocessStatus();
  }

  @Post('reprocess')
  @HttpCode(202)
  startReprocess() {
    return this.invoicesService.startReprocess();
  }

  @Post('reassign-warehouse')
  reassignWarehouse() {
    return this.invoicesService.reassignWarehouseInvoices();
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

  @Patch(':id/assign')
  assignVehicle(@Param('id') id: string, @Body() body: { vehicleId: string }) {
    return this.invoicesService.assignVehicle(id, body.vehicleId);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.invoicesService.delete(id);
  }

  // ── KI-Betrugscheck für einzelne Rechnung ─────────────────────────────────
  @Post(':id/fraud-check')
  @HttpCode(200)
  async fraudCheck(@Param('id') id: string) {
    const invoice = await this.invoicesService.findOne(id);
    if (!invoice.positions || invoice.positions.length === 0) {
      return { anomalies: [], message: 'Keine Positionen zum Prüfen vorhanden' };
    }
    const positions = invoice.positions.map(p => ({
      description: p.description,
      quantity: Number(p.quantity) || 1,
      unit: p.unit ?? 'Stk',
      unitPrice: Number(p.unitPrice) || 0,
      totalPrice: Number(p.totalPrice) || 0,
      category: p.category,
      isAnomaly: p.isAnomaly,
      anomalyReason: p.anomalyReason,
    }));
    const anomalies = await this.aiAnalysisService.checkFraudWithAI(
      invoice.repairContext ?? 'Unbekannte Reparatur',
      positions,
      null,
    );
    return { anomalies, checkedAt: new Date().toISOString() };
  }
}
