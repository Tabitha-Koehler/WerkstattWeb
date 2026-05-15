import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import {
  Invoice, Vehicle, LatestInspections, TireHistory, MileageHistory, TimelineEvent,
  TIRE_AXLE_LABELS, TIRE_SEASON_LABELS, MILEAGE_SOURCE_LABELS,
} from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-vehicle-detail',
  templateUrl: './vehicle-detail.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe, DecimalPipe, ReactiveFormsModule, ButtonModule, TagModule, TooltipModule],
})
export class VehicleDetailComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  readonly router = inject(Router);
  private api     = inject(ApiService);
  private fb      = inject(FormBuilder);

  loading      = true;
  vehicle: Vehicle | null = null;
  invoiceData: Invoice[]  = [];
  inspections: LatestInspections = {};
  tireHistory: TireHistory[]     = [];
  mileageHistory: MileageHistory[] = [];
  timeline: TimelineEvent[] = [];

  totalCost    = 0;
  anomalyCount = 0;

  activeTab = signal<'overview' | 'history' | 'invoices'>('overview');

  setTab(id: string) { this.activeTab.set(id as 'overview' | 'history' | 'invoices'); }

  showTireForm    = signal(false);
  showMileageForm = signal(false);
  savingTire      = signal(false);
  savingMileage   = signal(false);

  readonly axleOptions = Object.entries(TIRE_AXLE_LABELS).map(([v, l]) => ({ value: v, label: l }));
  readonly seasonOptions = Object.entries(TIRE_SEASON_LABELS).map(([v, l]) => ({ value: v, label: l }));
  readonly axleLabel = TIRE_AXLE_LABELS;
  readonly seasonLabel = TIRE_SEASON_LABELS;
  readonly mileageSourceLabel = MILEAGE_SOURCE_LABELS;

  tireForm = this.fb.group({
    changeDate:   [''],
    axle:         [''],
    season:       [''],
    tireSize:     [''],
    manufacturer: [''],
    dot:          [''],
    profileDepth: [null as number | null],
    mileage:      [null as number | null],
    notes:        [''],
  });

  mileageForm = this.fb.group({
    date:    ['', Validators.required],
    mileage: [null as number | null, [Validators.required, Validators.min(0)]],
    notes:   [''],
  });

  private vehicleId = '';

  readonly timelineIcons: Record<string, string> = {
    repair: 'fa-wrench',
    inspection: 'fa-clipboard-check',
    supply: 'fa-oil-can',
    tire: 'fa-circle-dot',
    mileage: 'fa-gauge',
    invoice: 'fa-receipt',
  };

  readonly timelineColors: Record<string, string> = {
    repair: '#3b82f6',
    inspection: '#10b981',
    supply: '#f59e0b',
    tire: '#8b5cf6',
    mileage: '#6b7280',
    invoice: '#64748b',
  };

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id')!;

    this.api.getVehicle(this.vehicleId).subscribe({
      next: (v) => { this.vehicle = v; this.loading = false; },
    });

    this.api.getInvoices(this.vehicleId).subscribe({
      next: (data) => {
        this.invoiceData  = data;
        this.totalCost    = data.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
        this.anomalyCount = data.filter(i => i.hasAnomalies).length;
      },
    });

    this.api.getLatestInspections(this.vehicleId).subscribe({
      next: (data) => { this.inspections = data; },
    });

    this.api.getVehicleTimeline(this.vehicleId).subscribe({
      next: (data) => { this.timeline = data; },
    });

    this.loadTireHistory();
    this.loadMileageHistory();
  }

  private loadTireHistory(): void {
    this.api.getTireHistory(this.vehicleId).subscribe({
      next: (data) => { this.tireHistory = data; },
    });
  }

  private loadMileageHistory(): void {
    this.api.getMileageHistory(this.vehicleId).subscribe({
      next: (data) => { this.mileageHistory = data; },
    });
  }

  saveTireEntry(): void {
    if (this.savingTire()) return;
    this.savingTire.set(true);
    this.api.addTireEntry(this.vehicleId, this.tireForm.value as any).subscribe({
      next: () => {
        this.loadTireHistory();
        this.showTireForm.set(false);
        this.tireForm.reset();
        this.savingTire.set(false);
      },
      error: () => this.savingTire.set(false),
    });
  }

  saveMileageEntry(): void {
    if (this.mileageForm.invalid || this.savingMileage()) return;
    this.savingMileage.set(true);
    this.api.addMileageEntry(this.vehicleId, { ...this.mileageForm.value, source: 'MANUAL' } as any).subscribe({
      next: () => {
        this.loadMileageHistory();
        this.showMileageForm.set(false);
        this.mileageForm.reset();
        this.savingMileage.set(false);
      },
      error: () => this.savingMileage.set(false),
    });
  }

  deleteTireEntry(id: string): void {
    this.api.deleteTireEntry(this.vehicleId, id).subscribe({
      next: () => this.loadTireHistory(),
    });
  }

  deleteMileageEntry(id: string): void {
    this.api.deleteMileageEntry(this.vehicleId, id).subscribe({
      next: () => this.loadMileageHistory(),
    });
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
