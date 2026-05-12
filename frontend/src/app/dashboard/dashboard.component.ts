import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/services/api.service';
import { Invoice, Inspection } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe],
})
export class DashboardComponent {
  private api = inject(ApiService);

  stats             = toSignal(this.api.getInvoiceStats());
  private invoices$ = toSignal(this.api.getInvoices());
  upcomingInspections = toSignal(this.api.getUpcomingInspections(60), { initialValue: [] as Inspection[] });
  overdueInspections  = toSignal(this.api.getOverdueInspections(),     { initialValue: [] as Inspection[] });

  loading       = computed(() => this.stats() === undefined || this.invoices$() === undefined);
  recentInvoices = computed(() => (this.invoices$() ?? [] as Invoice[]).slice(0, 5));

  daysUntil(dateStr: string): number {
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  inspectionClass(dateStr: string): string {
    const d = this.daysUntil(dateStr);
    if (d < 0)   return 'status-overdue';
    if (d <= 14) return 'status-soon';
    return 'status-ok';
  }
}
