import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { LatestInspections } from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-vehicle-detail',
  templateUrl: './vehicle-detail.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe, ButtonModule, TagModule, TooltipModule],
})
export class VehicleDetailComponent {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private api    = inject(ApiService);

  private vehicleId = this.route.snapshot.paramMap.get('id')!;

  private vehicleRes     = rxResource({ stream: () => this.api.getVehicle(this.vehicleId) });
  private invoicesRes    = rxResource({ stream: () => this.api.getInvoices(this.vehicleId) });
  private inspectionsRes = rxResource({ stream: () => this.api.getLatestInspections(this.vehicleId) });

  vehicle           = computed(() => this.vehicleRes.value());
  invoices          = computed(() => this.invoicesRes.value() ?? []);
  latestInspections = computed(() => this.inspectionsRes.value() ?? {} as LatestInspections);
  loading           = computed(() => this.vehicleRes.isLoading());
  totalCost         = computed(() => this.invoices().reduce((s, i) => s + (Number(i.totalAmount) || 0), 0));
  anomalyCount      = computed(() => this.invoices().filter(i => i.hasAnomalies).length);

  constructor() {
    // Redirect if vehicle not found
    if (this.vehicleRes.error()) this.router.navigate(['/vehicles']);
  }

  goToInvoice(inv: { id: string }): void { this.router.navigate(['/invoices', inv.id]); }

  daysUntil(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  inspectionStatusClass(dateStr: string | undefined): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return 'status-unknown';
    if (d < 0)     return 'status-overdue';
    if (d <= 30)   return 'status-soon';
    return 'status-ok';
  }

  inspectionStatusText(dateStr: string | undefined): string {
    const d = this.daysUntil(dateStr);
    if (d === null) return 'Kein Datum';
    if (d < 0)     return `${Math.abs(d)} Tage überfällig`;
    if (d === 0)   return 'Heute fällig!';
    return `Noch ${d} Tage`;
  }
}
