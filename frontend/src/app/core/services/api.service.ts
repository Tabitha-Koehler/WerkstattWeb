import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vehicle, Invoice, InvoiceStats, Inspection, LatestInspections } from '../models/models';

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

  getPdfUrl(id: string): string {
    return `${this.base}/invoices/${id}/pdf`;
  }
}
