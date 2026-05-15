import { Component, inject, computed, signal, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../core/services/api.service';
import { ReprocessStatus } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe, ButtonModule],
})
export class DashboardComponent implements OnDestroy {
  private api = inject(ApiService);

  stats    = toSignal(this.api.getInvoiceStats());
  invoices = toSignal(this.api.getInvoices());
  overdue  = toSignal(this.api.getOverdueInspections());
  upcoming = toSignal(this.api.getUpcomingInspections(60));

  loading        = computed(() => this.stats() === undefined || this.invoices() === undefined);
  recentInvoices = computed(() => (this.invoices() ?? []).slice(0, 5));

  reprocessStatus = signal<ReprocessStatus | null>(null);
  reprocessStarted = signal(false);
  private pollInterval: any = null;

  startReprocess(): void {
    this.reprocessStarted.set(true);
    this.api.startReprocess().subscribe({
      next: () => {
        this.pollStatus();
        this.pollInterval = setInterval(() => this.pollStatus(), 1500);
      },
    });
  }

  private pollStatus(): void {
    this.api.getReprocessStatus().subscribe({
      next: (status) => {
        this.reprocessStatus.set(status);
        if (!status.running && this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
          // Stats neu laden
          this.api.getInvoiceStats().subscribe(s => this.stats = toSignal(this.api.getInvoiceStats()));
        }
      },
    });
  }

  get progressPercent(): number {
    const s = this.reprocessStatus();
    if (!s || s.total === 0) return 0;
    return Math.round((s.done / s.total) * 100);
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

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
