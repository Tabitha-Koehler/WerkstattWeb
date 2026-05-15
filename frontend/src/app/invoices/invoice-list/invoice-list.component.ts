import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { PaginatorModule } from 'primeng/paginator';
import { ApiService } from '../../core/services/api.service';
import { Invoice } from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  imports: [RouterLink, DatePipe, CurrencyPipe, ButtonModule, TagModule, PaginatorModule],
})
export class InvoiceListComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  private _all = toSignal(this.api.getInvoices());

  loading           = computed(() => this._all() === undefined);
  showOnlyAnomalies = signal(false);
  searchTerm        = signal('');
  first             = signal(0);
  rows              = signal(25);

  filteredInvoices = computed(() => {
    const all = this._all() ?? [];
    let r = all;
    if (this.showOnlyAnomalies()) r = r.filter(i => i.hasAnomalies);
    const t = this.searchTerm();
    if (t) {
      const tl = t.toLowerCase();
      r = r.filter(i =>
        i.vehicle?.licensePlate?.toLowerCase().includes(tl) ||
        i.workshopName?.toLowerCase().includes(tl) ||
        i.repairContext?.toLowerCase().includes(tl) ||
        i.invoiceNumber?.toLowerCase().includes(tl)
      );
    }
    return r;
  });

  pagedInvoices = computed(() =>
    this.filteredInvoices().slice(this.first(), this.first() + this.rows())
  );

  onSearch(v: string):  void { this.searchTerm.set(v); this.first.set(0); }
  toggleAnomalies():    void { this.showOnlyAnomalies.update(x => !x); this.first.set(0); }
  onPageChange(e: { first: number; rows: number }): void {
    this.first.set(e.first);
    this.rows.set(e.rows);
  }
  goToDetail(inv: Invoice): void { this.router.navigate(['/invoices', inv.id]); }
}
