import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../../core/services/api.service';
import { Invoice } from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  imports: [RouterLink, FormsModule, DatePipe, CurrencyPipe, ButtonModule, TagModule],
})
export class InvoiceListComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  filter            = signal('');
  showOnlyAnomalies = signal(false);

  private invoicesRes = rxResource({ stream: () => this.api.getInvoices(undefined, false) });

  loading = computed(() => this.invoicesRes.isLoading());

  filteredInvoices = computed(() => {
    const invoices = this.invoicesRes.value() ?? [] as Invoice[];
    const search   = this.filter().toLowerCase();
    return invoices.filter(inv => {
      const matchText = !search
        || (inv.vehicle?.licensePlate ?? '').toLowerCase().includes(search)
        || (inv.workshopName ?? '').toLowerCase().includes(search)
        || (inv.repairContext ?? '').toLowerCase().includes(search)
        || (inv.invoiceNumber ?? '').toLowerCase().includes(search);
      return matchText && (!this.showOnlyAnomalies() || inv.hasAnomalies);
    });
  });

  toggleAnomalies(): void { this.showOnlyAnomalies.update(v => !v); }
  goToDetail(inv: Invoice): void { this.router.navigate(['/invoices', inv.id]); }
}
