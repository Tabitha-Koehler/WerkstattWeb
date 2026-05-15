import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { ApiService } from '../core/services/api.service';
import { Invoice, Vehicle } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-warehouse',
  templateUrl: './warehouse.component.html',
  imports: [DatePipe, CurrencyPipe, TagModule, PaginatorModule],
})
export class WarehouseComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  private _all   = toSignal(this.api.getInvoices(undefined, true));
  private _removed = signal<Set<string>>(new Set());

  vehicles = toSignal(this.api.getVehicles(), { initialValue: [] as Vehicle[] });

  loading   = computed(() => this._all() === undefined);
  tableData = computed(() => {
    const removed = this._removed();
    return (this._all() ?? []).filter(i => !removed.has(i.id));
  });
  totalCost = computed(() =>
    this.tableData().reduce((s, i) => s + (Number(i.totalAmount) || 0), 0)
  );

  first = signal(0);
  rows  = signal(25);

  pagedInvoices = computed(() =>
    this.tableData().slice(this.first(), this.first() + this.rows())
  );

  assigningId       = signal<string | null>(null);
  selectedVehicleId = signal<string>('');
  assigning         = signal(false);

  onPageChange(event: { first: number; rows: number }): void {
    this.first.set(event.first);
    this.rows.set(event.rows);
  }

  goToDetail(inv: Invoice): void { this.router.navigate(['/invoices', inv.id]); }

  startAssign(event: Event, inv: Invoice): void {
    event.stopPropagation();
    this.assigningId.set(inv.id);
    this.selectedVehicleId.set('');
  }

  cancelAssign(event: Event): void {
    event.stopPropagation();
    this.assigningId.set(null);
  }

  confirmAssign(event: Event, inv: Invoice): void {
    event.stopPropagation();
    const vehicleId = this.selectedVehicleId();
    if (!vehicleId) return;
    this.assigning.set(true);
    this.api.assignInvoiceToVehicle(inv.id, vehicleId).subscribe({
      next: () => {
        this.assigning.set(false);
        this.assigningId.set(null);
        this._removed.update(s => { const n = new Set(s); n.add(inv.id); return n; });
      },
      error: () => { this.assigning.set(false); },
    });
  }

  vehicleLabel(v: Vehicle): string {
    return v.licensePlate + (v.name ? ` – ${v.name}` : '');
  }
}
