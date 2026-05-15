import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../core/services/api.service';
import { WorkshopStats, VehicleCostStats, MonthlyCost, FraudSummary, RepeatedRepair, WorkshopAlert, PriceAnomaly } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, ButtonModule, TagModule, TooltipModule],
})
export class AnalyticsComponent implements OnInit {
  private api    = inject(ApiService);
  readonly router = inject(Router);

  loading       = true;
  fraudLoading  = signal(true);

  workshops: WorkshopStats[]     = [];
  vehicleCosts: VehicleCostStats[] = [];
  monthlyCosts: MonthlyCost[]    = [];
  fraudSummary: FraudSummary | null = null;

  totalCostAll      = 0;
  maxWorkshopAmount = 0;
  maxVehicleAmount  = 0;
  maxMonthlyAmount  = 0;

  // Fraud section state
  activeAlertTab = signal<'repeated' | 'workshop' | 'price'>('repeated');

  ngOnInit(): void {
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading = false; };

    this.api.getWorkshopStats().subscribe({
      next: (data) => {
        this.workshops = data;
        this.maxWorkshopAmount = Math.max(...data.map(w => w.totalAmount), 1);
        done();
      },
      error: () => done(),
    });

    this.api.getVehicleCosts().subscribe({
      next: (data) => {
        this.vehicleCosts = data;
        this.totalCostAll = data.reduce((s, v) => s + v.totalAmount, 0);
        this.maxVehicleAmount = Math.max(...data.map(v => v.totalAmount), 1);
        done();
      },
      error: () => done(),
    });

    this.api.getMonthlyCosts().subscribe({
      next: (data) => {
        this.monthlyCosts = data.slice(-18);
        this.maxMonthlyAmount = Math.max(...data.map(m => m.totalAmount), 1);
        done();
      },
      error: () => done(),
    });

    this.api.getFraudAlerts().subscribe({
      next: (data) => { this.fraudSummary = data; this.fraudLoading.set(false); },
      error: () => { this.fraudLoading.set(false); },
    });
  }

  barWidth(value: number, max: number): string {
    return Math.round((value / max) * 100) + '%';
  }

  formatMonth(month: string): string {
    if (!month) return '';
    const [y, m] = month.split('-');
    const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${names[parseInt(m) - 1]} ${y}`;
  }

  severityColor(s: string): string {
    return s === 'danger' ? 'text-red-600 dark:text-red-400'
         : s === 'warn'   ? 'text-amber-600 dark:text-amber-400'
         :                  'text-blue-600 dark:text-blue-400';
  }

  severityBg(s: string): string {
    return s === 'danger' ? 'bg-red-500/10 dark:bg-red-500/20'
         : s === 'warn'   ? 'bg-amber-500/10 dark:bg-amber-500/20'
         :                  'bg-blue-500/10 dark:bg-blue-500/20';
  }

  severityIcon(s: string): string {
    return s === 'danger' ? 'fa-circle-xmark'
         : s === 'warn'   ? 'fa-triangle-exclamation'
         :                  'fa-circle-info';
  }

  goToInvoice(invoiceId: string): void {
    this.router.navigate(['/invoices', invoiceId]);
  }

  goToVehicle(vehicleId: string): void {
    this.router.navigate(['/vehicles', vehicleId]);
  }
}
