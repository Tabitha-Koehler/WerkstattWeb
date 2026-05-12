import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../database/entities/invoice.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { InvoicePosition, PositionCategory } from '../database/entities/invoice-position.entity';
import { Inspection, InspectionType } from '../database/entities/inspection.entity';
import { OperatingSupply } from '../database/entities/operating-supply.entity';
import { PdfParserService } from '../pdf-parser/pdf-parser.service';
import { AiAnalysisService } from '../ai-analysis/ai-analysis.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(InvoicePosition) private positionRepo: Repository<InvoicePosition>,
    @InjectRepository(Inspection) private inspectionRepo: Repository<Inspection>,
    @InjectRepository(OperatingSupply) private supplyRepo: Repository<OperatingSupply>,
    private readonly pdfParser: PdfParserService,
    private readonly aiAnalysis: AiAnalysisService,
  ) {}

  async processInvoiceFile(filePath: string): Promise<Invoice> {
    const filename = path.basename(filePath);
    this.logger.log(`Verarbeite Rechnung: ${filename}`);

    const invoice = this.invoiceRepo.create({
      originalFilename: filename,
      pdfPath: filePath,
    });
    await this.invoiceRepo.save(invoice);

    try {
      const rawText = await this.pdfParser.extractText(filePath);
      invoice.rawText = rawText;

      const analysis = await this.aiAnalysis.analyzeInvoice(rawText, filename);

      invoice.workshopName = analysis.workshopName;
      invoice.invoiceNumber = analysis.invoiceNumber;
      invoice.invoiceDate = analysis.invoiceDate;
      invoice.totalAmount = analysis.totalAmount;
      invoice.repairContext = analysis.repairContext;
      invoice.aiSummary = analysis.summary;
      invoice.hasAnomalies = analysis.anomalies?.length > 0;
      invoice.isWarehouse = !analysis.licensePlate;

      if (analysis.licensePlate) {
        const normalizedPlate = analysis.licensePlate.toUpperCase().trim();
        let vehicle = await this.vehicleRepo.findOne({ where: { licensePlate: normalizedPlate } });
        if (!vehicle) {
          vehicle = this.vehicleRepo.create({ licensePlate: normalizedPlate });
          await this.vehicleRepo.save(vehicle);
          this.logger.log(`Neues Fahrzeug erstellt: ${normalizedPlate}`);
        }
        invoice.vehicleId = vehicle.id;
      }

      await this.invoiceRepo.save(invoice);

      if (analysis.positions?.length) {
        const positions = analysis.positions.map((p) =>
          this.positionRepo.create({
            invoiceId: invoice.id,
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            unitPrice: p.unitPrice,
            totalPrice: p.totalPrice,
            category: (p.category as PositionCategory) || PositionCategory.OTHER,
            isAnomaly: p.isAnomaly || false,
            anomalyReason: p.anomalyReason || null,
          }),
        );
        await this.positionRepo.save(positions);
      }

      if (analysis.inspections?.length) {
        const inspections = analysis.inspections.map((insp) =>
          this.inspectionRepo.create({
            vehicleId: invoice.vehicleId,
            invoiceId: invoice.id,
            type: insp.type as InspectionType,
            inspectionDate: insp.date,
            nextDueDate: insp.nextDueDate,
          }),
        );
        await this.inspectionRepo.save(inspections);
      }

      if (analysis.operatingSupplies?.length) {
        const supplies = analysis.operatingSupplies.map((s) =>
          this.supplyRepo.create({
            vehicleId: invoice.vehicleId,
            invoiceId: invoice.id,
            type: s.type,
            quantity: s.quantity,
            unit: s.unit,
            date: analysis.invoiceDate,
          }),
        );
        await this.supplyRepo.save(supplies);
      }

      this.logger.log(`Rechnung ${filename} erfolgreich verarbeitet`);
    } catch (error) {
      invoice.processingError = true;
      invoice.processingErrorMessage = error.message;
      await this.invoiceRepo.save(invoice);
      this.logger.error(`Fehler bei ${filename}: ${error.message}`);
    }

    return this.findOne(invoice.id);
  }

  async findAll(vehicleId?: string, isWarehouse?: boolean): Promise<Invoice[]> {
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.vehicle', 'vehicle')
      .orderBy('invoice.createdAt', 'DESC');

    if (vehicleId) {
      query.andWhere('invoice.vehicleId = :vehicleId', { vehicleId });
    }
    if (isWarehouse !== undefined) {
      query.andWhere('invoice.isWarehouse = :isWarehouse', { isWarehouse });
    }

    return query.getMany();
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['vehicle', 'positions', 'inspections', 'operatingSupplies'],
    });
    if (!invoice) throw new NotFoundException(`Rechnung ${id} nicht gefunden`);
    return invoice;
  }

  async delete(id: string): Promise<void> {
    const invoice = await this.findOne(id);
    await this.invoiceRepo.remove(invoice);
  }

  async getStats(): Promise<any> {
    const total = await this.invoiceRepo.count();
    const withAnomalies = await this.invoiceRepo.count({ where: { hasAnomalies: true } });
    const warehouse = await this.invoiceRepo.count({ where: { isWarehouse: true } });
    const errors = await this.invoiceRepo.count({ where: { processingError: true } });
    return { total, withAnomalies, warehouse, errors };
  }
}
