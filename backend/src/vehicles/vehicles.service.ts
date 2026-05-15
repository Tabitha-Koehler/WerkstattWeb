import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Inspection } from '../database/entities/inspection.entity';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { OperatingSupply } from '../database/entities/operating-supply.entity';
import { TireHistory } from '../database/entities/tire-history.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';
import { Invoice } from '../database/entities/invoice.entity';

export interface TimelineEvent {
  date: string | null;
  type: 'repair' | 'inspection' | 'supply' | 'tire' | 'mileage' | 'invoice';
  description: string;
  detail?: string;
  invoiceId?: string;
  severity: 'normal' | 'warning';
}

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Inspection) private inspectionRepo: Repository<Inspection>,
    @InjectRepository(InvoicePosition) private positionRepo: Repository<InvoicePosition>,
    @InjectRepository(OperatingSupply) private supplyRepo: Repository<OperatingSupply>,
    @InjectRepository(TireHistory) private tireRepo: Repository<TireHistory>,
    @InjectRepository(MileageHistory) private mileageRepo: Repository<MileageHistory>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
  ) {}

  async findAll(): Promise<Vehicle[]> {
    return this.vehicleRepo.find({ order: { licensePlate: 'ASC' } });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException(`Fahrzeug ${id} nicht gefunden`);
    return vehicle;
  }

  async create(data: Partial<Vehicle>): Promise<Vehicle> {
    const existing = await this.vehicleRepo.findOne({ where: { licensePlate: data.licensePlate } });
    if (existing) throw new ConflictException(`Kennzeichen ${data.licensePlate} bereits vorhanden`);
    const vehicle = this.vehicleRepo.create(data);
    return this.vehicleRepo.save(vehicle);
  }

  async update(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    Object.assign(vehicle, data);
    return this.vehicleRepo.save(vehicle);
  }

  async delete(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehicleRepo.remove(vehicle);
  }

  async getLatestInspections(vehicleId: string): Promise<Record<string, Inspection>> {
    const types = ['SP', 'HU', 'AU'];
    const result: Record<string, Inspection> = {};
    for (const type of types) {
      const insp = await this.inspectionRepo.findOne({
        where: { vehicleId, type: type as any },
        order: { inspectionDate: 'DESC' },
      });
      if (insp) result[type] = insp;
    }
    return result;
  }

  async getUpcomingInspections(daysBefore = 60): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysBefore);
    return this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vehicle', 'vehicle')
      .where('i.nextDueDate IS NOT NULL')
      .andWhere('i.nextDueDate <= :cutoff', { cutoff: cutoffDate.toISOString().split('T')[0] })
      .orderBy('i.nextDueDate', 'ASC')
      .getMany();
  }

  // ── Fahrzeugdaten aus Rechnungen befüllen ────────────────────────────────
  async enrichFromInvoices(vehicleId?: string): Promise<{ updated: number; details: string[] }> {
    const WMI_MAP: Record<string, string> = {
      WMA: 'MAN', WMX: 'MAN', W09: 'MAN', WMN: 'MAN',
      WDB: 'Mercedes-Benz', WEB: 'Mercedes-Benz', WDF: 'Mercedes-Benz', WDD: 'Mercedes-Benz',
      YS2: 'Scania', XLR: 'DAF', XLE: 'DAF', XL9: 'DAF',
      WAU: 'Audi', WVW: 'Volkswagen', WBA: 'BMW', WBS: 'BMW',
      WJM: 'Iveco', YV2: 'Volvo', VBN: 'Volvo', VSK: 'Renault Trucks',
      WSM: 'Schmitz Cargobull', WK0: 'Kögel', WK1: 'Kögel',
      KNA: 'Kia', KNM: 'Kia', W0L: 'Opel',
    };

    const VIN_YEAR_MAP: Record<string, number> = {
      A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
      J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
      T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
      '1': 2031, '2': 2032, '3': 2033, '4': 2034, '5': 2035,
      '6': 2036, '7': 2037, '8': 2038, '9': 2039,
    };

    const extractFromText = (text: string): { vin: string | null; manufacturer: string | null; model: string | null; year: number | null } => {
      // VIN: 17-char alphanumeric (no I, O, Q)
      // Try multiple patterns — Werneke has VIN directly before license plate (no separator)
      const vinPatterns = [
        /([A-HJ-NPR-Z0-9]{17})[A-Z]{2,4}-/,             // Werneke: VIN immediately before plate "WMA18XZZ0HM742932HAM-CK"
        /FIN[:\s\/]+([A-HJ-NPR-Z0-9]{17})/i,            // "FIN: WMA18XZZ0HM742932"
        /Fahrgestellnummer[:\s\/]+([A-HJ-NPR-Z0-9]{17})/i,
        /VIN[:\s\/]+([A-HJ-NPR-Z0-9]{17})/i,
        /(?:^|\s)([A-HJ-NPR-Z0-9]{17})(?:\s|$)/m,       // standalone, surrounded by whitespace
      ];
      let vin: string | null = null;
      for (const pat of vinPatterns) {
        const m = text.match(pat);
        if (m) { vin = m[1]; break; }
      }
      if (!vin) return { vin: null, manufacturer: null, model: null, year: null };

      // Year from VIN position 9 (10th character); subtract 30 if future (cycle repeats every 30yr)
      const currentYear = new Date().getFullYear();
      let year = VIN_YEAR_MAP[vin[9]] ?? null;
      if (year && year > currentYear) year -= 30;

      // Manufacturer from WMI
      const wmi = vin.substring(0, 3);
      let manufacturer: string | null = WMI_MAP[wmi] ?? null;

      // Try to extract manufacturer from text (Werneke: "MAN   19.04.2017HU:")
      const BAD_MFG = new Set(['TRUCK', 'CENTER', 'GMBH', 'AG', 'KG', 'UG', 'WERKSTATT', 'SERVICE', 'AUTO']);
      const mfgMatch = text.match(/([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]{1,25})\s+\d{2}\.\d{2}\.\d{4}HU:/);
      if (mfgMatch && !BAD_MFG.has(mfgMatch[1].toUpperCase())) {
        manufacturer = mfgMatch[1].trim();
        // Normalize known abbreviations
        if (manufacturer === 'BENZ' || manufacturer === 'MERCEDES') manufacturer = 'Mercedes-Benz';
        else if (manufacturer === 'MERCEDES-BENZ') manufacturer = 'Mercedes-Benz';
        else if (manufacturer === 'MAN') manufacturer = 'MAN';
        else if (manufacturer === 'SCANIA') manufacturer = 'Scania';
        else if (manufacturer === 'IVECO' || manufacturer === 'IVECO-MAGIRUS') manufacturer = 'Iveco';
        else if (manufacturer === 'OPEL') manufacturer = 'Opel';
      } else {
        // Try "Marke:" label
        const markeMatch = text.match(/Marke[:\s]+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\s\-]{1,25}?)(?:\r?\n|Baujahr|Jahr|Modell|$)/im);
        if (markeMatch) manufacturer = markeMatch[1].trim();
      }

      // Model: text on same line just before VIN (Werneke format: "TGX   WMA18XZZ0HM742932")
      // Use [ \t] instead of \s to avoid crossing newlines
      let model: string | null = null;
      const modelLineMatch = text.match(/^([A-Za-z0-9][A-Za-z0-9 \t\/.-]{1,25}?)[ \t]{2,}[A-HJ-NPR-Z0-9]{17}/m);
      if (modelLineMatch) {
        const candidate = modelLineMatch[1].trim();
        const hasLetter = /[A-Za-z]/.test(candidate);
        const isPlate = /^\w{2,4}-\w/.test(candidate);          // license plate pattern
        const isInvoiceNum = /^\d{4,}$/.test(candidate);        // pure number like "26-70317"
        if (hasLetter && !isPlate && !isInvoiceNum && candidate.length >= 2) {
          model = candidate;
        }
      }
      if (!model) {
        // Try "Modell:" label — must be on same line, no newlines in value
        const modellMatch = text.match(/Modell[:\s]+([A-Za-z][A-Za-z0-9 \t\/.-]{1,30}?)(?:\r?\n|FIN:|VIN:|Baujahr|$)/im);
        if (modellMatch) {
          const m = modellMatch[1].trim();
          if (m.length >= 2) model = m;
        }
      }

      return { vin, manufacturer, model, year };
    };

    const vehicles = await this.vehicleRepo.find(vehicleId ? { where: { id: vehicleId } } : {});
    let updated = 0;
    const details: string[] = [];

    for (const vehicle of vehicles) {
      const needsEnrichment = !vehicle.vin || !vehicle.manufacturer || !vehicle.model || !vehicle.year;
      if (!needsEnrichment) continue;

      const invoices = await this.invoiceRepo.find({
        where: { vehicleId: vehicle.id },
        select: ['id', 'rawText'],
      });

      let bestVin: string | null = null;
      let bestManufacturer: string | null = null;
      let bestModel: string | null = null;
      let bestYear: number | null = null;

      for (const inv of invoices) {
        if (!inv.rawText) continue;
        const extracted = extractFromText(inv.rawText);
        if (extracted.vin && !bestVin) bestVin = extracted.vin;
        if (extracted.manufacturer && !bestManufacturer) bestManufacturer = extracted.manufacturer;
        if (extracted.model && !bestModel) bestModel = extracted.model;
        if (extracted.year && !bestYear) bestYear = extracted.year;
        if (bestVin && bestManufacturer && bestModel && bestYear) break;
      }

      const changes: string[] = [];
      if (bestVin && !vehicle.vin)                   { vehicle.vin = bestVin;                   changes.push(`FIN: ${bestVin}`); }
      if (bestManufacturer && !vehicle.manufacturer) { vehicle.manufacturer = bestManufacturer; changes.push(`Marke: ${bestManufacturer}`); }
      if (bestModel && !vehicle.model)               { vehicle.model = bestModel;               changes.push(`Modell: ${bestModel}`); }
      if (bestYear && !vehicle.year)                 { vehicle.year = bestYear;                 changes.push(`Baujahr: ${bestYear}`); }

      if (changes.length > 0) {
        await this.vehicleRepo.save(vehicle);
        updated++;
        details.push(`${vehicle.licensePlate}: ${changes.join(', ')}`);
      }
    }

    return { updated, details };
  }

  // ── Fahrzeug-Zeitstrahl ────────────────────────────────────────────────────
  async getTimeline(vehicleId: string): Promise<TimelineEvent[]> {
    await this.findOne(vehicleId); // 404 wenn nicht gefunden

    const events: TimelineEvent[] = [];

    // Reparaturpositionen (REPAIR/PARTS) aus Rechnungen
    const positions = await this.positionRepo
      .createQueryBuilder('p')
      .innerJoin('p.invoice', 'inv')
      .where('inv.vehicleId = :vehicleId', { vehicleId })
      .andWhere('p.category IN (:...cats)', { cats: ['REPAIR', 'PARTS', 'LABOR', 'INSPECTION', 'BETRIEBSMITTEL'] })
      .select(['p.description', 'p.category', 'p.quantity', 'p.unit', 'p.totalPrice', 'p.isAnomaly', 'p.anomalyReason', 'inv.invoiceDate', 'inv.id', 'inv.workshopName'])
      .orderBy('inv.invoiceDate', 'DESC')
      .limit(200)
      .getRawMany();

    for (const p of positions) {
      const typeMap: Record<string, TimelineEvent['type']> = {
        REPAIR: 'repair', PARTS: 'repair', LABOR: 'repair',
        INSPECTION: 'inspection', BETRIEBSMITTEL: 'supply',
      };
      const detail = p.p_totalPrice ? `${Number(p.p_totalPrice).toFixed(2)} €` : undefined;
      events.push({
        date: p.inv_invoiceDate,
        type: typeMap[p.p_category] || 'repair',
        description: p.p_description,
        detail,
        invoiceId: p.inv_id,
        severity: p.p_isAnomaly ? 'warning' : 'normal',
      });
    }

    // Prüfungen (SP/HU/AU)
    const inspections = await this.inspectionRepo.find({
      where: { vehicleId },
      order: { inspectionDate: 'DESC' },
    });
    for (const insp of inspections) {
      const label = insp.type === 'SP' ? 'Sicherheitsprüfung' : insp.type === 'HU' ? 'Hauptuntersuchung' : 'Abgasuntersuchung';
      events.push({
        date: insp.inspectionDate,
        type: 'inspection',
        description: `${label} (${insp.type})`,
        detail: insp.nextDueDate ? `Nächste Fälligkeit: ${insp.nextDueDate}` : undefined,
        invoiceId: insp.invoiceId,
        severity: 'normal',
      });
    }

    // Reifenwechsel
    const tires = await this.tireRepo.find({
      where: { vehicleId },
      order: { changeDate: 'DESC' },
    });
    for (const t of tires) {
      const parts: string[] = [];
      if (t.tireSize) parts.push(t.tireSize);
      if (t.manufacturer) parts.push(t.manufacturer);
      if (t.season) parts.push({ SUMMER: 'Sommer', WINTER: 'Winter', ALL_SEASON: 'Ganzjahr' }[t.season] || t.season);
      events.push({
        date: t.changeDate,
        type: 'tire',
        description: `Reifenwechsel${t.axle ? ' — ' + t.axle : ''}`,
        detail: parts.join(', ') || undefined,
        invoiceId: t.invoiceId,
        severity: 'normal',
      });
    }

    // Kilometerstände
    const mileages = await this.mileageRepo.find({
      where: { vehicleId },
      order: { date: 'DESC' },
    });
    for (const m of mileages) {
      events.push({
        date: m.date,
        type: 'mileage',
        description: `Kilometerstand: ${m.mileage.toLocaleString('de-DE')} km`,
        detail: m.notes || undefined,
        invoiceId: m.invoiceId,
        severity: 'normal',
      });
    }

    // Sortierung: neueste zuerst, null-Datum ans Ende
    events.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    return events;
  }
}
