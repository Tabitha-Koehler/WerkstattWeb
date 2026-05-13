import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/services/api.service';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe],
})
export class DashboardComponent {
  private api = inject(ApiService);

  statsRes    = rxResource({ stream: () => this.api.getInvoiceStats() });
  invoicesRes = rxResource({ stream: () => this.api.getInvoices() });
  overdueRes  = rxResource({ stream: () => this.api.getOverdueInspections() });
  upcomingRes = rxResource({ stream: () => this.api.getUpcomingInspections(60) });

  loading              = computed(() => this.statsRes.isLoading() || this.invoicesRes.isLoading());
  stats                = computed(() => this.statsRes.value());
  recentInvoices       = computed(() => (this.invoicesRes.value() ?? [] as any[]).slice(0, 5));
  overdueInspections   = computed(() => this.overdueRes.value()  ?? []);
  upcomingInspections  = computed(() => this.upcomingRes.value() ?? []);

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
