import { Component, OnInit } from '@angular/core';
import { ApiService } from '../core/services/api.service';
import { Invoice, InvoiceStats, Inspection } from '../core/models/models';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  stats: InvoiceStats | null = null;
  recentInvoices: Invoice[] = [];
  upcomingInspections: Inspection[] = [];
  overdueInspections: Inspection[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;

    this.api.getInvoiceStats().subscribe(s => this.stats = s);

    this.api.getInvoices().subscribe(inv => {
      this.recentInvoices = inv.slice(0, 5);
      this.loading = false;
    });

    this.api.getUpcomingInspections(60).subscribe(insp => this.upcomingInspections = insp);
    this.api.getOverdueInspections().subscribe(insp => this.overdueInspections = insp);
  }

  daysUntil(dateStr: string): number {
    const due = new Date(dateStr);
    const today = new Date();
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  inspectionClass(dateStr: string): string {
    const d = this.daysUntil(dateStr);
    if (d < 0) return 'status-overdue';
    if (d <= 14) return 'status-soon';
    return 'status-ok';
  }
}
