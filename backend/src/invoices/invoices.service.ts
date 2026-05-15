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
import { MileageHistory, MileageSource } from '../database/entities/mileage-history.entity';
import { PdfParserService, ZugferdData } from '../pdf-parser/pdf-parser.service';
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
    @InjectRepository(MileageHistory) private mileageRepo: Repository<MileageHistory>,
    private readonly pdfParser: PdfParserService,
    private readonly aiAnalysis: AiAnalysisService,
  ) {}

  async processInvoiceFile(filePath: string): Promise<Invoice> {
    const filename = path.basename(filePath);

    // Skip files that were already successfully processed
    const existing = await this.invoiceRepo.findOne({ where: { pdfPath: filePath } });
    if (existing) {
      this.logger.log(`Bereits verarbeitet, übersprungen: ${filename}`);
      return this.findOne(existing.id);
    }

    this.logger.log(`Verarbeite Rechnung: ${filename}`);

    const invoice = this.invoiceRepo.create({
      originalFilename: filename,
      pdfPath: filePath,
    });
    await this.invoiceRepo.save(invoice);

    try {
      const rawText = await this.pdfParser.extractText(filePath);
      invoice.rawText = rawText;

      // Try ZUGFeRD XML first (structured, reliable data)
      const zugferd = await this.pdfParser.extractZugferdData(filePath);
      if (zugferd) {
        this.logger.log(`ZUGFeRD: seller=${zugferd.sellerName}, plate=${zugferd.licensePlate}, total=${zugferd.totalAmount}, items=${zugferd.lineItems?.length}`);
      }

      // Gescannte PDFs haben kaum extrahierbaren Text → Tesseract OCR
      const isScanned = rawText.trim().length < 100;
      let effectiveText = rawText;
      if (isScanned) {
        this.logger.log(`Gescanntes PDF erkannt (${rawText.trim().length} Zeichen) — starte Tesseract OCR für ${filename}`);
        const pdfBuffer = fs.readFileSync(filePath);
        const ocrText = await this.pdfParser.ocrPdf(pdfBuffer);
        if (ocrText.trim().length > 50) {
          effectiveText = ocrText;
          invoice.rawText = ocrText;
          this.logger.log(`Tesseract OCR erfolgreich: ${ocrText.length} Zeichen aus ${filename}`);
        } else {
          this.logger.warn(`Tesseract OCR lieferte zu wenig Text für ${filename} — regelbasierter Fallback`);
        }
      }
      const analysis = await this.aiAnalysis.analyzeInvoice(effectiveText, filename);

      // ZUGFeRD data overrides AI where available
      invoice.workshopName = zugferd?.sellerName || analysis.workshopName;
      invoice.invoiceNumber = zugferd?.invoiceNumber || analysis.invoiceNumber;
      invoice.invoiceDate   = zugferd?.invoiceDate   || analysis.invoiceDate;
      invoice.totalAmount   = zugferd?.totalAmount   ?? (analysis.totalAmount ? Number(analysis.totalAmount) : null);
      invoice.hasAnomalies  = analysis.anomalies?.length > 0;

      // repairContext: AI-Ergebnis wenn sinnvoll, sonst aus ZUGFeRD-Positionen ableiten
      const aiContext = analysis.repairContext;
      const contextIsGarbage = !aiContext || aiContext.includes('€') || aiContext.includes('Endbetrag')
        || aiContext.includes('@') || aiContext.includes('$') || aiContext.length < 5;
      if (contextIsGarbage) {
        // Aus ZUGFeRD-Positionen oder KI-Positionen ableiten
        const sourceItems = zugferd?.lineItems?.length
          ? zugferd.lineItems
          : (analysis.positions ?? []).map(p => ({ description: p.description }));
        const mainItems = sourceItems
          .filter(li => !li.description.toLowerCase().includes('rabatt'))
          .slice(0, 3)
          .map(li => li.description)
          .filter(d => d && !d.includes('@') && !d.includes('$') && !d.includes('€') && d.length > 2)
          .join(', ');
        invoice.repairContext = mainItems || null;
      } else {
        invoice.repairContext = aiContext;
      }

      // aiSummary: AI-Ergebnis wenn sinnvoll, sonst aus ZUGFeRD-Daten generieren
      const aiSummary = analysis.summary;
      const summaryIsGarbage = !aiSummary || aiSummary.includes('€') || aiSummary.includes('Endbetrag') || aiSummary.length < 10;
      if (summaryIsGarbage && zugferd) {
        const buyer = zugferd.buyerName ? ` für ${zugferd.buyerName}` : '';
        const items = zugferd.lineItems?.slice(0, 3).map(li => li.description).join(', ') || '';
        invoice.aiSummary = `Rechnung von ${zugferd.sellerName || 'Werkstatt'}${buyer}. Arbeiten: ${items || 'siehe Positionen'}. Gesamtbetrag: ${zugferd.totalAmount?.toFixed(2)} ${zugferd.currency}.`;
      } else {
        invoice.aiSummary = aiSummary;
      }

      let licensePlate = zugferd?.licensePlate || analysis.licensePlate;

      // FIN-basierte Fahrzeugsuche: wenn kein Kennzeichen aber FIN bekannt → DB-Lookup
      if (!licensePlate && zugferd?.vehicleFin) {
        const vehicleByFin = await this.vehicleRepo.findOne({ where: { vin: zugferd.vehicleFin } });
        if (vehicleByFin) {
          licensePlate = vehicleByFin.licensePlate;
          this.logger.log(`Fahrzeug über FIN ${zugferd.vehicleFin} gefunden: ${licensePlate}`);
        }
      }

      invoice.isWarehouse = !licensePlate;

      if (licensePlate) {
        const normalizedPlate = licensePlate.toUpperCase().trim();
        // Race-condition-safe upsert: INSERT ON CONFLICT DO NOTHING + findOne
        await this.vehicleRepo
          .createQueryBuilder()
          .insert()
          .into(Vehicle)
          .values({ licensePlate: normalizedPlate })
          .orIgnore()
          .execute();
        const vehicle = await this.vehicleRepo.findOne({ where: { licensePlate: normalizedPlate } });
        if (vehicle) {
          invoice.vehicleId = vehicle.id;
          this.logger.log(`Fahrzeug zugeordnet: ${normalizedPlate}`);
        }
      }

      await this.invoiceRepo.save(invoice);

      // Use ZUGFeRD line items when available (more accurate than AI extraction)
      const sourcePositions = zugferd?.lineItems?.length
        ? zugferd.lineItems.map(li => ({
            description: li.description,
            quantity: li.quantity,
            unit: li.unit,
            unitPrice: li.unitPrice,
            totalPrice: li.totalPrice,
            category: PositionCategory.OTHER,
            isAnomaly: false,
            anomalyReason: null,
          }))
        : (analysis.positions ?? []);

      if (sourcePositions.length) {
        // Merge anomaly info from AI analysis into ZUGFeRD positions by description match
        const anomalyMap = new Map<string, string>();
        for (const a of analysis.anomalies ?? []) {
          anomalyMap.set(a.positionDescription?.toLowerCase(), a.reason);
        }
        // Also carry over category + anomaly flags from AI positions when using ZUGFeRD
        const aiPosMap = new Map<string, typeof analysis.positions[0]>();
        for (const ap of analysis.positions ?? []) {
          aiPosMap.set(ap.description?.toLowerCase(), ap);
        }

        const positions = sourcePositions.map((p) => {
          const aiMatch = aiPosMap.get(p.description?.toLowerCase());
          const anomalyReason = anomalyMap.get(p.description?.toLowerCase()) || p.anomalyReason;
          return this.positionRepo.create({
            invoiceId: invoice.id,
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            unitPrice: p.unitPrice,
            totalPrice: p.totalPrice,
            category: (aiMatch?.category as PositionCategory) || p.category || PositionCategory.OTHER,
            isAnomaly: !!anomalyReason || p.isAnomaly,
            anomalyReason: anomalyReason || null,
          });
        });
        await this.positionRepo.save(positions);
      }

      // km-Stand aus Rechnung → MileageHistory (nur wenn Fahrzeug bekannt und Wert plausibel)
      const mileageFromInvoice = analysis.mileage;
      if (mileageFromInvoice && mileageFromInvoice > 100 && invoice.vehicleId) {
        const existing = await this.mileageRepo.findOne({
          where: { vehicleId: invoice.vehicleId, invoiceId: invoice.id },
        });
        if (!existing) {
          await this.mileageRepo.save(
            this.mileageRepo.create({
              vehicleId: invoice.vehicleId,
              invoiceId: invoice.id,
              mileage: mileageFromInvoice,
              date: analysis.serviceDate || invoice.invoiceDate,
              source: MileageSource.INVOICE,
              notes: `Aus Rechnung ${invoice.invoiceNumber || invoice.originalFilename}`,
            }),
          );
          this.logger.log(`km-Stand ${mileageFromInvoice} km aus Rechnung gespeichert`);
        }
      }

      // Wiederholungsreparatur-Check
      if (invoice.vehicleId && invoice.invoiceDate && sourcePositions.length) {
        const savedPositions = await this.positionRepo.find({ where: { invoiceId: invoice.id } });
        await this.checkRepeatedRepairs(invoice.vehicleId, invoice.id, savedPositions, invoice.invoiceDate);
        const hasRepeatAnomaly = savedPositions.some(p => p.isAnomaly);
        if (hasRepeatAnomaly && !invoice.hasAnomalies) {
          invoice.hasAnomalies = true;
          await this.invoiceRepo.save(invoice);
        }
      }

      // Prüfungen aus AI oder ZUGFeRD-Notizen
      let inspectionSources = analysis.inspections ?? [];
      if (zugferd) {
        if (zugferd.nextSpDate && !inspectionSources.some(i => i.type === 'SP')) {
          inspectionSources = [...inspectionSources, { type: 'SP' as const, date: invoice.invoiceDate, nextDueDate: zugferd.nextSpDate }];
        }
        if (zugferd.nextHuDate && !inspectionSources.some(i => i.type === 'HU')) {
          inspectionSources = [...inspectionSources, { type: 'HU' as const, date: invoice.invoiceDate, nextDueDate: zugferd.nextHuDate }];
        }
      }
      if (inspectionSources.length) {
        const inspections = inspectionSources.map((insp) =>
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

      // Betriebsmittel: aus ZUGFeRD-Positionen ableiten wenn AI nichts findet
      let supplySources = analysis.operatingSupplies ?? [];
      if (!supplySources.length && zugferd?.lineItems?.length) {
        const oilKeywords = ['öl', 'oil', 'motoröl', 'getriebeöl', 'hydrauliköl', 'adblue', 'kühlmittel', 'bremsflüssigkeit', 'frostschutz'];
        for (const li of zugferd.lineItems) {
          const desc = li.description.toLowerCase();
          if (oilKeywords.some(k => desc.includes(k))) {
            const typeLabel = desc.includes('adblue') ? 'AdBlue'
              : desc.includes('kühlmittel') ? 'Kühlmittel'
              : desc.includes('bremsflüssigkeit') ? 'Bremsflüssigkeit'
              : desc.includes('getriebe') ? 'Getriebeöl'
              : desc.includes('hydraulik') ? 'Hydrauliköl'
              : 'Öl';
            supplySources = [...supplySources, { type: typeLabel, quantity: li.quantity, unit: li.unit }];
          }
        }
      }
      if (supplySources.length) {
        const supplies = supplySources.map((s) =>
          this.supplyRepo.create({
            vehicleId: invoice.vehicleId,
            invoiceId: invoice.id,
            type: s.type,
            quantity: s.quantity,
            unit: s.unit,
            date: invoice.invoiceDate || analysis.invoiceDate,
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

  async findAll(vehicleId?: string, isWarehouse?: boolean): Promise<Partial<Invoice>[]> {
    const query = this.invoiceRepo
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.vehicle', 'vehicle')
      .select([
        'invoice.id', 'invoice.vehicleId', 'invoice.workshopName', 'invoice.invoiceNumber',
        'invoice.invoiceDate', 'invoice.totalAmount', 'invoice.repairContext',
        'invoice.hasAnomalies', 'invoice.isWarehouse', 'invoice.processingError',
        'invoice.processingErrorMessage', 'invoice.originalFilename', 'invoice.createdAt',
        'vehicle.id', 'vehicle.licensePlate',
      ])
      .orderBy('invoice.invoiceDate', 'DESC')
      .addOrderBy('invoice.createdAt', 'DESC');

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

  async assignVehicle(invoiceId: string, vehicleId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException(`Rechnung ${invoiceId} nicht gefunden`);
    const vehicle = await this.vehicleRepo.findOne({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException(`Fahrzeug ${vehicleId} nicht gefunden`);
    invoice.vehicleId = vehicleId;
    invoice.isWarehouse = false;
    await this.invoiceRepo.save(invoice);
    return this.findOne(invoiceId);
  }

  async getStats(): Promise<any> {
    const total = await this.invoiceRepo.count();
    const withAnomalies = await this.invoiceRepo.count({ where: { hasAnomalies: true } });
    const warehouse = await this.invoiceRepo.count({ where: { isWarehouse: true } });
    const errors = await this.invoiceRepo.count({ where: { processingError: true } });
    return { total, withAnomalies, warehouse, errors };
  }

  // ── Reprocess Progress ─────────────────────────────────────────────────────
  private reprocessStatus: {
    running: boolean;
    total: number;
    done: number;
    anomaliesFound: number;
    errors: number;
    startedAt: Date | null;
    finishedAt: Date | null;
    currentFile: string;
  } = {
    running: false, total: 0, done: 0, anomaliesFound: 0,
    errors: 0, startedAt: null, finishedAt: null, currentFile: '',
  };

  getReprocessStatus() {
    return { ...this.reprocessStatus };
  }

  async startReprocess(): Promise<{ message: string }> {
    if (this.reprocessStatus.running) {
      return { message: 'Verarbeitung läuft bereits' };
    }

    const invoices = await this.invoiceRepo.find({
      where: [{ processingError: false }, { processingError: null as any }],
      select: ['id', 'rawText', 'pdfPath', 'originalFilename', 'repairContext'],
    });

    this.reprocessStatus = {
      running: true,
      total: invoices.length,
      done: 0,
      anomaliesFound: 0,
      errors: 0,
      startedAt: new Date(),
      finishedAt: null,
      currentFile: '',
    };

    // Asynchron im Hintergrund ausführen
    this.runReprocess(invoices).catch(err =>
      this.logger.error(`Reprocess-Fehler: ${err.message}`),
    );

    return { message: `Neuverarbeitung gestartet für ${invoices.length} Rechnungen` };
  }

  private async runReprocess(invoices: Pick<Invoice, 'id' | 'rawText' | 'pdfPath' | 'originalFilename' | 'repairContext'>[]) {
    for (const inv of invoices) {
      const isScanned = !inv.rawText || inv.rawText.trim().length < 100;
      const hasPdf = inv.pdfPath && fs.existsSync(inv.pdfPath);

      if (isScanned && !hasPdf) {
        this.reprocessStatus.done++;
        continue;
      }

      this.reprocessStatus.currentFile = inv.originalFilename ?? inv.id;

      try {
        let effectiveText = inv.rawText ?? '';
        if (isScanned && hasPdf) {
          this.logger.log(`Reprocess: Tesseract OCR für ${inv.originalFilename}`);
          const pdfBuffer = fs.readFileSync(inv.pdfPath);
          const ocrText = await this.pdfParser.ocrPdf(pdfBuffer);
          if (ocrText.trim().length > 50) effectiveText = ocrText;
        }
        const analysis = await this.aiAnalysis.analyzeInvoice(effectiveText, inv.originalFilename ?? '');

        // Anomalie-Map aufbauen
        const anomalyMap = new Map<string, string>();
        for (const a of analysis.anomalies ?? []) {
          if (a.positionDescription) {
            anomalyMap.set(a.positionDescription.toLowerCase(), a.reason);
          }
        }

        // Bestehende Positionen mit Anomalie-Flags aktualisieren
        const positions = await this.positionRepo.find({ where: { invoiceId: inv.id } });
        let invoiceHasAnomaly = false;

        for (const pos of positions) {
          const key = pos.description?.toLowerCase() ?? '';
          // Exakter Treffer oder Teil-Treffer
          let anomalyReason: string | null = anomalyMap.get(key) ?? null;
          if (!anomalyReason) {
            for (const [keyword, reason] of anomalyMap) {
              if (key.includes(keyword) || keyword.includes(key.substring(0, 8))) {
                anomalyReason = reason;
                break;
              }
            }
          }
          // Kategorie aus KI übernehmen wenn verfügbar
          const aiPos = (analysis.positions ?? []).find(p =>
            p.description?.toLowerCase() === key ||
            key.includes(p.description?.toLowerCase()?.substring(0, 8) ?? '___')
          );

          const changed =
            pos.isAnomaly !== !!anomalyReason ||
            pos.anomalyReason !== (anomalyReason ?? null) ||
            (aiPos && pos.category !== aiPos.category as any);

          if (changed) {
            pos.isAnomaly = !!anomalyReason;
            pos.anomalyReason = anomalyReason;
            if (aiPos && aiPos.category) pos.category = aiPos.category as any;
            await this.positionRepo.save(pos);
          }
          if (pos.isAnomaly) invoiceHasAnomaly = true;
        }

        // Anomalien ohne passende Position als eigene Positionen speichern
        for (const [keyword, reason] of anomalyMap) {
          const alreadyCovered = positions.some(p =>
            p.description?.toLowerCase().includes(keyword)
          );
          if (!alreadyCovered) {
            const newPos = this.positionRepo.create({
              invoiceId: inv.id,
              description: keyword,
              category: PositionCategory.OTHER,
              isAnomaly: true,
              anomalyReason: reason,
            });
            await this.positionRepo.save(newPos);
            invoiceHasAnomaly = true;
          }
        }

        // Invoice-Felder aktualisieren
        const updateData: Partial<Invoice> = { hasAnomalies: invoiceHasAnomaly };
        if (analysis.summary && !inv.repairContext) updateData.aiSummary = analysis.summary;
        await this.invoiceRepo.update(inv.id, updateData);

        if (invoiceHasAnomaly) this.reprocessStatus.anomaliesFound++;
      } catch (err) {
        this.logger.warn(`Reprocess-Fehler bei ${inv.originalFilename}: ${err.message}`);
        this.reprocessStatus.errors++;
      }

      this.reprocessStatus.done++;
    }

    this.reprocessStatus.running = false;
    this.reprocessStatus.finishedAt = new Date();
    this.reprocessStatus.currentFile = '';
    this.logger.log(
      `Reprocess abgeschlossen: ${this.reprocessStatus.anomaliesFound} Anomalien in ${this.reprocessStatus.total} Rechnungen`,
    );
  }

  // ── Wiederholungsreparatur-Erkennung ───────────────────────────────────────
  private async checkRepeatedRepairs(
    vehicleId: string,
    currentInvoiceId: string,
    positions: InvoicePosition[],
    invoiceDate: string,
  ): Promise<void> {
    const since = new Date(invoiceDate);
    since.setDate(since.getDate() - 90);

    for (const pos of positions) {
      if (pos.category !== PositionCategory.REPAIR && pos.category !== PositionCategory.PARTS) continue;
      if (!pos.description || pos.description.length < 5) continue;

      const keyword = pos.description.substring(0, 12).toLowerCase();

      const similar = await this.positionRepo
        .createQueryBuilder('p')
        .innerJoin('p.invoice', 'inv')
        .where('inv.vehicleId = :vehicleId', { vehicleId })
        .andWhere('inv.id != :currentInvoiceId', { currentInvoiceId })
        .andWhere('inv.invoiceDate >= :since', { since: since.toISOString().substring(0, 10) })
        .andWhere('LOWER(p.description) LIKE :keyword', { keyword: `%${keyword}%` })
        .select(['p.id', 'inv.invoiceDate', 'inv.invoiceNumber'])
        .getOne();

      if (similar) {
        const prevDate = (similar as any).inv_invoiceDate || '';
        const prevNum = (similar as any).inv_invoiceNumber || '';
        pos.isAnomaly = true;
        pos.anomalyReason = `Gleiche Reparatur bereits innerhalb von 90 Tagen${prevDate ? ' am ' + prevDate : ''}${prevNum ? ' (Rech. ' + prevNum + ')' : ''} durchgeführt`;
        await this.positionRepo.save(pos);
      }
    }
  }
}
