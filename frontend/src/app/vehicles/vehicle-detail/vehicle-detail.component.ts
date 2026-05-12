import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Vehicle, Invoice, LatestInspections } from '../../core/models/models';

@Component({
  standalone: false,
  selector: 'app-vehicle-detail',
  templateUrl: './vehicle-detail.component.html',
  styleUrls: ['./vehicle-detail.component.scss'],
})
export class VehicleDetailComponent implements OnInit {
  vehicle: Vehicle | null = null;
  invoices: Invoice[] = [];
  latestInspections: LatestInspections = {};
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getVehicle(id).subscribe({
      next: v => {
        this.vehicle = v;
        this.loadInvoices(id);
        this.loadInspections(id);
      },
      error: () => {
        this.router.navigate(['/vehicles']);
      },
    });
  }

  loadInvoices(id: string): void {
    this.api.getInvoices(id).subscribe(inv => {
      this.invoices = inv;
      this.loading = false;
    });
  }

  loadInspections(id: string): void {
    this.api.getLatestInspections(id).subscribe(insp => {
      this.latestInspections = insp;
    });
  }

  goToInvoice(inv: Invoice): void {
    this.router.navigate(['/invoices', inv.id]);
  }

  daysUntil(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    const due = new Date(dateStr);
    const today = new Date();
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  inspectionStatusClass(dateStr: string | undefined): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return 'status-unknown';
    if (d < 0)  return 'status-overdue';
    if (d <= 30) return 'status-soon';
    return 'status-ok';
  }

  inspectionStatusText(dateStr: string | undefined): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return 'Kein Datum';
    if (d < 0)  return `${Math.abs(d)} Tage überfällig ⚠️`;
    if (d === 0) return 'Heute fällig!';
    if (d <= 30) return `Noch ${d} Tage`;
    return `Noch ${d} Tage`;
  }

  totalCost(): number {
    return this.invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
  }

  anomalyCount(): number {
    return this.invoices.filter(i => i.hasAnomalies).length;
  }
}
