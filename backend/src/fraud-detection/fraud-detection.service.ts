import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { Invoice } from '../database/entities/invoice.entity';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface RepeatedRepair {
  vehicleId: string;
  licensePlate: string;
  description: string;
  count: number;
  daysBetween: number;
  occurrences: Array<{
    invoiceId: string;
    invoiceDate: string;
    workshopName: string;
    totalAmount: number;
  }>;
  severity: 'info' | 'warn' | 'danger';
  message: string;
}

export interface WorkshopAlert {
  workshopName: string;
  invoiceCount: number;
  anomalyCount: number;
  anomalyRate: number;
  totalAmount: number;
  severity: 'info' | 'warn' | 'danger';
  message: string;
}

export interface PriceAnomaly {
  invoiceId: string;
  vehicleId: string;
  licensePlate: string;
  workshopName: string;
  invoiceDate: string;
  description: string;
  unitPrice: number;
  fleetAvgPrice: number;
  deviation: number;
  severity: 'warn' | 'danger';
  message: string;
}

export interface FraudSummary {
  repeatedRepairs: RepeatedRepair[];
  workshopAlerts: WorkshopAlert[];
  priceAnomalies: PriceAnomaly[];
  totalAlerts: number;
  dangerCount: number;
  warnCount: number;
  infoCount: number;
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(InvoicePosition) private positionRepo: Repository<InvoicePosition>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
  ) {}

  // ── Wiederholte Reparaturen ───────────────────────────────────────────────
  async getRepeatedRepairs(lookbackDays = 90): Promise<RepeatedRepair[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const rows = await this.positionRepo
      .createQueryBuilder('p')
      .innerJoin('p.invoice', 'inv')
      .innerJoin('inv.vehicle', 'vehicle')
      .where('p.category IN (:...cats)', { cats: ['REPAIR', 'PARTS', 'INSPECTION'] })
      .andWhere('inv.invoiceDate >= :cutoff', { cutoff: cutoffStr })
      .andWhere('inv.vehicleId IS NOT NULL')
      .select([
        'p.description as p_description',
        'inv.id as inv_id',
        'inv."vehicleId" as inv_vehicle_id',
        'inv."invoiceDate" as inv_invoice_date',
        'inv."workshopName" as inv_workshop_name',
        'inv."totalAmount" as inv_total_amount',
        'vehicle."licensePlate" as vehicle_license_plate',
      ])
      .orderBy('inv."vehicleId"', 'ASC')
      .addOrderBy('inv."invoiceDate"', 'ASC')
      .getRawMany();

    // Normalize description for grouping
    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-zäöüß0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 30);

    // Group by vehicleId + normalised description
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.inv_vehicle_id}::${norm(row.p_description || '')}`;
      if (!groups.has(key)) groups.set(key, []);
      const g = groups.get(key)!;
      // One entry per invoice (avoid position duplicates within same invoice)
      if (!g.find(e => e.inv_id === row.inv_id)) g.push(row);
    }

    const result: RepeatedRepair[] = [];
    for (const [, items] of groups) {
      if (items.length < 2) continue;
      const sorted = [...items].sort((a, b) =>
        (a.inv_invoice_date ?? '') > (b.inv_invoice_date ?? '') ? 1 : -1,
      );
      const first = new Date(sorted[0].inv_invoice_date);
      const last = new Date(sorted[sorted.length - 1].inv_invoice_date);
      const daysBetween = isNaN(first.getTime()) || isNaN(last.getTime())
        ? 0
        : Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86_400_000));

      const severity: RepeatedRepair['severity'] =
        daysBetween <= 30 ? 'danger' : daysBetween <= 60 ? 'warn' : 'info';

      result.push({
        vehicleId: sorted[0].inv_vehicle_id,
        licensePlate: sorted[0].vehicle_license_plate,
        description: sorted[0].p_description,
        count: sorted.length,
        daysBetween,
        occurrences: sorted.map(p => ({
          invoiceId: p.inv_id,
          invoiceDate: p.inv_invoice_date,
          workshopName: p.inv_workshop_name || 'Unbekannt',
          totalAmount: parseFloat(p.inv_total_amount) || 0,
        })),
        severity,
        message: `"${sorted[0].p_description}" bei ${sorted[0].vehicle_license_plate ?? '?'}: ${sorted.length}× in ${daysBetween} Tagen`,
      });
    }

    return result.sort((a, b) => {
      const s = { danger: 0, warn: 1, info: 2 };
      if (s[a.severity] !== s[b.severity]) return s[a.severity] - s[b.severity];
      return a.daysBetween - b.daysBetween;
    });
  }

  // ── Werkstatt-Anomalien ───────────────────────────────────────────────────
  async getWorkshopAlerts(): Promise<WorkshopAlert[]> {
    const rows = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('inv."workshopName"', 'workshopName')
      .addSelect('COUNT(inv.id)', 'invoiceCount')
      .addSelect('SUM(CASE WHEN inv."hasAnomalies" THEN 1 ELSE 0 END)', 'anomalyCount')
      .addSelect('SUM(inv."totalAmount")', 'totalAmount')
      .where('inv."workshopName" IS NOT NULL')
      .andWhere('inv."isWarehouse" = false')
      .groupBy('inv."workshopName"')
      .having('COUNT(inv.id) >= 3')
      .getRawMany();

    return rows
      .map(r => {
        const count = parseInt(r.invoiceCount, 10);
        const anomalies = parseInt(r.anomalyCount, 10);
        const rate = count > 0 ? Math.round((anomalies / count) * 100) : 0;
        const total = parseFloat(r.totalAmount) || 0;

        let severity: WorkshopAlert['severity'] = 'info';
        let message = `${rate}% Anomalierate (${anomalies}/${count} Rechnungen)`;
        if (rate >= 50) {
          severity = 'danger';
          message = `⚠ Sehr hohe Anomalierate: ${rate}% (${anomalies} von ${count} Rechnungen)`;
        } else if (rate >= 25) {
          severity = 'warn';
          message = `Erhöhte Anomalierate: ${rate}% (${anomalies} von ${count} Rechnungen)`;
        }

        return {
          workshopName: r.workshopName,
          invoiceCount: count,
          anomalyCount: anomalies,
          anomalyRate: rate,
          totalAmount: total,
          severity,
          message,
        };
      })
      .filter(w => w.anomalyRate >= 20)
      .sort((a, b) => b.anomalyRate - a.anomalyRate);
  }

  // ── Preisanomalien ────────────────────────────────────────────────────────
  async getPriceAnomalies(minDeviationPct = 80): Promise<PriceAnomaly[]> {
    const rows = await this.positionRepo
      .createQueryBuilder('p')
      .innerJoin('p.invoice', 'inv')
      .innerJoin('inv.vehicle', 'vehicle')
      .where('p."unitPrice" > 0')
      .andWhere('p.quantity > 0')
      .andWhere('inv."vehicleId" IS NOT NULL')
      .andWhere('p.category IN (:...cats)', { cats: ['REPAIR', 'PARTS', 'LABOR'] })
      .select([
        'p.id as p_id',
        'p.description as p_description',
        'p."unitPrice" as p_unit_price',
        'inv.id as inv_id',
        'inv."vehicleId" as inv_vehicle_id',
        'inv."invoiceDate" as inv_invoice_date',
        'inv."workshopName" as inv_workshop_name',
        'vehicle."licensePlate" as vehicle_license_plate',
      ])
      .getRawMany();

    const norm = (s: string) =>
      s.toLowerCase()
        .replace(/[^a-zäöüß0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 30);

    // Compute fleet average per normalised description
    const priceGroups = new Map<string, number[]>();
    for (const row of rows) {
      const key = norm(row.p_description || '');
      if (!priceGroups.has(key)) priceGroups.set(key, []);
      priceGroups.get(key)!.push(parseFloat(row.p_unit_price));
    }

    const anomalies: PriceAnomaly[] = [];
    for (const row of rows) {
      const desc: string = row.p_description || '';
      // Skip header artifacts and garbage (no spaces in long strings = table header)
      if (desc.length > 15 && !desc.includes(' ') && /[A-Z]{2}/.test(desc)) continue;
      const key = norm(desc);
      const prices = priceGroups.get(key) ?? [];
      if (prices.length < 3) continue; // Need enough data points
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      if (avg < 10) continue; // Skip cheap consumables

      const price = parseFloat(row.p_unit_price);
      const deviation = Math.round(((price - avg) / avg) * 100);
      if (Math.abs(deviation) < minDeviationPct) continue;

      // Only flag prices that are HIGHER than average (overpayment)
      if (deviation <= 0) continue;

      const severity: PriceAnomaly['severity'] = deviation >= 150 ? 'danger' : 'warn';

      anomalies.push({
        invoiceId: row.inv_id,
        vehicleId: row.inv_vehicle_id,
        licensePlate: row.vehicle_license_plate,
        workshopName: row.inv_workshop_name || 'Unbekannt',
        invoiceDate: row.inv_invoice_date,
        description: row.p_description,
        unitPrice: Math.round(price * 100) / 100,
        fleetAvgPrice: Math.round(avg * 100) / 100,
        deviation,
        severity,
        message: `"${row.p_description}": ${price.toFixed(2)} € vs. Ø ${avg.toFixed(2)} € (+${deviation}%)`,
      });
    }

    return anomalies
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 30); // Top 30 most egregious
  }

  // ── Zusammenfassung ───────────────────────────────────────────────────────
  async getAllAlerts(): Promise<FraudSummary> {
    const [repeatedRepairs, workshopAlerts, priceAnomalies] = await Promise.all([
      this.getRepeatedRepairs(90),
      this.getWorkshopAlerts(),
      this.getPriceAnomalies(80),
    ]);

    const allSeverities = [
      ...repeatedRepairs.map(r => r.severity),
      ...workshopAlerts.map(w => w.severity),
      ...priceAnomalies.map(p => p.severity),
    ];

    return {
      repeatedRepairs,
      workshopAlerts,
      priceAnomalies,
      totalAlerts: allSeverities.length,
      dangerCount: allSeverities.filter(s => s === 'danger').length,
      warnCount: allSeverities.filter(s => s === 'warn').length,
      infoCount: allSeverities.filter(s => s === 'info').length,
    };
  }
}
