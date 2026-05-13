import { Component, inject, computed, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/services/api.service';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe],
})
export class DashboardComponent {
  private api = inject(ApiService);

  private statsRes    = resource({ loader: () => firstValueFrom(this.api.getInvoiceStats()) });
  private invoicesRes = resource({ loader: () => firstValueFrom(this.api.getInvoices()) });
  private overdueRes  = resource({ loader: () => firstValueFrom(this.api.getOverdueInspections()) });
  private upcomingRes = resource({ loader: () => firstValueFrom(this.api.getUpcomingInspections(60)) });

  loading             = computed(() => this.statsRes.isLoading() || this.invoicesRes.isLoading());
  stats               = computed(() => this.statsRes.value());
  recentInvoices      = computed(() => (this.invoicesRes.value() ?? []).slice(0, 5));
  overdueInspections  = computed(() => this.overdueRes.value()  ?? []);
  upcomingInspections = computed(() => this.upcomingRes.value() ?? []);

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
