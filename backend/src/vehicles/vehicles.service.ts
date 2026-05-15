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
