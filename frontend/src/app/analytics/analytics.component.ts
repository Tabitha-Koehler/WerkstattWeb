import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ApiService } from '../core/services/api.service';
import { WorkshopStats, VehicleCostStats, MonthlyCost } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  imports: [RouterLink, CurrencyPipe, ButtonModule],
})
export class AnalyticsComponent implements OnInit {
  private api = inject(ApiService);

  loading = true;
  workshops: WorkshopStats[] = [];
  vehicleCosts: VehicleCostStats[] = [];
  monthlyCosts: MonthlyCost[] = [];

  totalCostAll = 0;
  maxWorkshopAmount = 0;
  maxVehicleAmount = 0;
  maxMonthlyAmount = 0;

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
        this.monthlyCosts = data.slice(-18); // letzte 18 Monate
        this.maxMonthlyAmount = Math.max(...data.map(m => m.totalAmount), 1);
        done();
      },
      error: () => done(),
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
}
