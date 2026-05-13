import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { TagModule } from 'primeng/tag';
import { ApiService } from '../core/services/api.service';
import { Invoice } from '../core/models/models';

@Component({
  standalone: true,
  selector: 'app-warehouse',
  templateUrl: './warehouse.component.html',
  imports: [DatePipe, CurrencyPipe, TagModule],
})
export class WarehouseComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  private invoicesRes = rxResource({ stream: () => this.api.getInvoices(undefined, true) });

  invoices  = computed(() => this.invoicesRes.value() ?? [] as Invoice[]);
  loading   = computed(() => this.invoicesRes.isLoading());
  totalCost = computed(() => this.invoices().reduce((s, i) => s + (Number(i.totalAmount) || 0), 0));

  goToDetail(inv: Invoice): void { this.router.navigate(['/invoices', inv.id]); }
}
