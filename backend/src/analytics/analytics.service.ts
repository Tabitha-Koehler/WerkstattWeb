import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../database/entities/invoice.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(MileageHistory) private mileageRepo: Repository<MileageHistory>,
  ) {}

  // ── Werkstatt-Vergleich ────────────────────────────────────────────────────
  async getWorkshopStats(): Promise<any[]> {
    const rows = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('inv.workshopName', 'workshopName')
      .addSelect('COUNT(inv.id)', 'invoiceCount')
      .addSelect('SUM(inv.totalAmount)', 'totalAmount')
      .addSelect('AVG(inv.totalAmount)', 'avgAmount')
      .addSelect('SUM(CASE WHEN inv.hasAnomalies THEN 1 ELSE 0 END)', 'anomalyCount')
      .where('inv.workshopName IS NOT NULL')
      .andWhere('inv.isWarehouse = false')
      .groupBy('inv.workshopName')
      .orderBy('"totalAmount"', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      workshopName: r.workshopName,
      invoiceCount: parseInt(r.invoiceCount),
      totalAmount: parseFloat(r.totalAmount) || 0,
      avgAmount: parseFloat(r.avgAmount) || 0,
      anomalyCount: parseInt(r.anomalyCount),
      anomalyRate: r.invoiceCount > 0 ? Math.round((r.anomalyCount / r.invoiceCount) * 100) : 0,
    }));
  }

  // ── Fahrzeugkosten ─────────────────────────────────────────────────────────
  async getVehicleCosts(): Promise<any[]> {
    const rows = await this.invoiceRepo
      .createQueryBuilder('inv')
      .innerJoin('inv.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.licensePlate', 'licensePlate')
      .addSelect('COUNT(inv.id)', 'invoiceCount')
      .addSelect('SUM(inv.totalAmount)', 'totalAmount')
      .addSelect('MIN(inv.invoiceDate)', 'firstInvoice')
      .addSelect('MAX(inv.invoiceDate)', 'lastInvoice')
      .where('inv.isWarehouse = false')
      .andWhere('inv.totalAmount IS NOT NULL')
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.licensePlate')
      .orderBy('"totalAmount"', 'DESC')
      .getRawMany();

    return rows.map(r => ({
      vehicleId: r.vehicleId,
      licensePlate: r.licensePlate,
      invoiceCount: parseInt(r.invoiceCount),
      totalAmount: parseFloat(r.totalAmount) || 0,
      firstInvoice: r.firstInvoice,
      lastInvoice: r.lastInvoice,
    }));
  }

  // ── Kosten pro km ──────────────────────────────────────────────────────────
  async getCostPerKm(vehicleId: string): Promise<any> {
    const costs = await this.invoiceRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.totalAmount)', 'totalAmount')
      .addSelect('COUNT(inv.id)', 'invoiceCount')
      .where('inv.vehicleId = :vehicleId', { vehicleId })
      .andWhere('inv.isWarehouse = false')
      .andWhere('inv.totalAmount IS NOT NULL')
      .getRawOne();

    const mileages = await this.mileageRepo.find({
      where: { vehicleId },
      order: { mileage: 'ASC' },
    });

    const minKm = mileages[0]?.mileage ?? null;
    const maxKm = mileages[mileages.length - 1]?.mileage ?? null;
    const kmDriven = minKm && maxKm && maxKm > minKm ? maxKm - minKm : null;
    const totalAmount = parseFloat(costs?.totalAmount) || 0;
    const costPerKm = kmDriven ? totalAmount / kmDriven : null;

    return {
      vehicleId,
      totalAmount,
      invoiceCount: parseInt(costs?.invoiceCount) || 0,
      minKm,
      maxKm,
      kmDriven,
      costPerKm: costPerKm ? Math.round(costPerKm * 100) / 100 : null,
    };
  }

  // ── Kosten-Trend (Monatlich) ───────────────────────────────────────────────
  async getMonthlyCosts(vehicleId?: string): Promise<any[]> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.invoiceDate::date, 'YYYY-MM')", 'month')
      .addSelect('SUM(inv.totalAmount)', 'totalAmount')
      .addSelect('COUNT(inv.id)', 'invoiceCount')
      .where('inv.totalAmount IS NOT NULL')
      .andWhere('inv.invoiceDate IS NOT NULL')
      .andWhere('inv.isWarehouse = false');

    if (vehicleId) {
      qb.andWhere('inv.vehicleId = :vehicleId', { vehicleId });
    }

    const rows = await qb
      .groupBy("TO_CHAR(inv.invoiceDate::date, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      month: r.month,
      totalAmount: parseFloat(r.totalAmount) || 0,
      invoiceCount: parseInt(r.invoiceCount),
    }));
  }
}
