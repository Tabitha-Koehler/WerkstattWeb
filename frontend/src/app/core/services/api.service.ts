import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vehicle, Invoice, InvoiceStats, Inspection, LatestInspections, TireHistory, MileageHistory, ReprocessStatus, TimelineEvent, WorkshopStats, VehicleCostStats, CostPerKm, MonthlyCost, FraudSummary, RepeatedRepair, WorkshopAlert, PriceAnomaly, InvoiceFraudCheck } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = '/api';

  constructor(private http: HttpClient) {}

  // ── Fahrzeuge ──────────────────────────────────────────────
  getVehicles(): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.base}/vehicles`);
  }

  getVehicle(id: string): Observable<Vehicle> {
    return this.http.get<Vehicle>(`${this.base}/vehicles/${id}`);
  }

  createVehicle(data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.post<Vehicle>(`${this.base}/vehicles`, data);
  }

  updateVehicle(id: string, data: Partial<Vehicle>): Observable<Vehicle> {
    return this.http.put<Vehicle>(`${this.base}/vehicles/${id}`, data);
  }

  deleteVehicle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/vehicles/${id}`);
  }

  getLatestInspections(vehicleId: string): Observable<LatestInspections> {
    return this.http.get<LatestInspections>(`${this.base}/inspections/vehicle/${vehicleId}/latest`);
  }

  getUpcomingInspections(days = 60): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(`${this.base}/inspections/due-soon?days=${days}`);
  }

  getOverdueInspections(): Observable<Inspection[]> {
    return this.http.get<Inspection[]>(`${this.base}/inspections/overdue`);
  }

  // ── Reifenhistorie ─────────────────────────────────────────
  getTireHistory(vehicleId: string): Observable<TireHistory[]> {
    return this.http.get<TireHistory[]>(`${this.base}/vehicles/${vehicleId}/tires`);
  }

  addTireEntry(vehicleId: string, data: Partial<TireHistory>): Observable<TireHistory> {
    return this.http.post<TireHistory>(`${this.base}/vehicles/${vehicleId}/tires`, data);
  }

  updateTireEntry(vehicleId: string, tireId: string, data: Partial<TireHistory>): Observable<TireHistory> {
    return this.http.put<TireHistory>(`${this.base}/vehicles/${vehicleId}/tires/${tireId}`, data);
  }

  deleteTireEntry(vehicleId: string, tireId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/vehicles/${vehicleId}/tires/${tireId}`);
  }

  // ── Kilometerstand ─────────────────────────────────────────
  getMileageHistory(vehicleId: string): Observable<MileageHistory[]> {
    return this.http.get<MileageHistory[]>(`${this.base}/vehicles/${vehicleId}/mileage`);
  }

  addMileageEntry(vehicleId: string, data: Partial<MileageHistory>): Observable<MileageHistory> {
    return this.http.post<MileageHistory>(`${this.base}/vehicles/${vehicleId}/mileage`, data);
  }

  updateMileageEntry(vehicleId: string, mileageId: string, data: Partial<MileageHistory>): Observable<MileageHistory> {
    return this.http.put<MileageHistory>(`${this.base}/vehicles/${vehicleId}/mileage/${mileageId}`, data);
  }

  deleteMileageEntry(vehicleId: string, mileageId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/vehicles/${vehicleId}/mileage/${mileageId}`);
  }

  // ── Rechnungen ─────────────────────────────────────────────
  getInvoices(vehicleId?: string, isWarehouse?: boolean): Observable<Invoice[]> {
    let params = new HttpParams();
    if (vehicleId) params = params.set('vehicleId', vehicleId);
    if (isWarehouse !== undefined) params = params.set('isWarehouse', String(isWarehouse));
    return this.http.get<Invoice[]>(`${this.base}/invoices`, { params });
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/invoices/${id}`);
  }

  getInvoiceStats(): Observable<InvoiceStats> {
    return this.http.get<InvoiceStats>(`${this.base}/invoices/stats`);
  }

  uploadInvoice(file: File): Observable<Invoice> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Invoice>(`${this.base}/invoices/upload`, formData);
  }

  deleteInvoice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/invoices/${id}`);
  }

  assignInvoiceToVehicle(invoiceId: string, vehicleId: string): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.base}/invoices/${invoiceId}/assign`, { vehicleId });
  }

  reassignWarehouseInvoices(): Observable<{ message: string; assigned: number; skipped: number }> {
    return this.http.post<{ message: string; assigned: number; skipped: number }>(`${this.base}/invoices/reassign-warehouse`, {});
  }

  getPdfUrl(id: string): string {
    return `${this.base}/invoices/${id}/pdf`;
  }

  // ── Neuverarbeitung ─────────────────────────────────────────
  startReprocess(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/invoices/reprocess`, {});
  }

  getReprocessStatus(): Observable<ReprocessStatus> {
    return this.http.get<ReprocessStatus>(`${this.base}/invoices/reprocess/status`);
  }

  // ── Fahrzeug-Timeline ───────────────────────────────────────
  getVehicleTimeline(vehicleId: string): Observable<TimelineEvent[]> {
    return this.http.get<TimelineEvent[]>(`${this.base}/vehicles/${vehicleId}/history`);
  }

  enrichVehicleFromInvoices(vehicleId: string): Observable<{ updated: number; details: string[] }> {
    return this.http.post<{ updated: number; details: string[] }>(`${this.base}/vehicles/${vehicleId}/enrich-from-invoices`, {});
  }

  enrichAllVehiclesFromInvoices(): Observable<{ updated: number; details: string[] }> {
    return this.http.post<{ updated: number; details: string[] }>(`${this.base}/vehicles/enrich-from-invoices`, {});
  }

  // ── Analytics ───────────────────────────────────────────────
  getWorkshopStats(): Observable<WorkshopStats[]> {
    return this.http.get<WorkshopStats[]>(`${this.base}/analytics/workshops`);
  }

  getVehicleCosts(): Observable<VehicleCostStats[]> {
    return this.http.get<VehicleCostStats[]>(`${this.base}/analytics/vehicles/costs`);
  }

  getCostPerKm(vehicleId: string): Observable<CostPerKm> {
    return this.http.get<CostPerKm>(`${this.base}/analytics/vehicles/${vehicleId}/cost-per-km`);
  }

  getMonthlyCosts(vehicleId?: string): Observable<MonthlyCost[]> {
    let params = new HttpParams();
    if (vehicleId) params = params.set('vehicleId', vehicleId);
    return this.http.get<MonthlyCost[]>(`${this.base}/analytics/monthly`, { params });
  }

  // ── Betrugs- und Plausibilitätsprüfung ───────────────────────────────────
  getFraudAlerts(): Observable<FraudSummary> {
    return this.http.get<FraudSummary>(`${this.base}/analytics/fraud-alerts`);
  }

  getRepeatedRepairs(days = 90): Observable<RepeatedRepair[]> {
    return this.http.get<RepeatedRepair[]>(`${this.base}/analytics/repeated-repairs?days=${days}`);
  }

  getWorkshopAlerts(): Observable<WorkshopAlert[]> {
    return this.http.get<WorkshopAlert[]>(`${this.base}/analytics/workshop-alerts`);
  }

  getPriceAnomalies(): Observable<PriceAnomaly[]> {
    return this.http.get<PriceAnomaly[]>(`${this.base}/analytics/price-anomalies`);
  }

  runInvoiceFraudCheck(invoiceId: string): Observable<InvoiceFraudCheck> {
    return this.http.post<InvoiceFraudCheck>(`${this.base}/invoices/${invoiceId}/fraud-check`, {});
  }
}
