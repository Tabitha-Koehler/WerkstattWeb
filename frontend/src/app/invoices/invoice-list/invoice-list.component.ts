import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Invoice } from '../../core/models/models';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss'],
})
export class InvoiceListComponent implements OnInit {
  allInvoices: Invoice[] = [];
  filteredInvoices: Invoice[] = [];
  loading = true;
  filter = '';
  showOnlyAnomalies = false;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.api.getInvoices(undefined, false).subscribe({
      next: invoices => { this.allInvoices = invoices; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false,
    });
  }

  applyFilter(): void {
    const search = this.filter.toLowerCase();
    this.filteredInvoices = this.allInvoices.filter(inv => {
      const matchText = !search
        || (inv.vehicle?.licensePlate ?? '').toLowerCase().includes(search)
        || (inv.workshopName ?? '').toLowerCase().includes(search)
        || (inv.repairContext ?? '').toLowerCase().includes(search)
        || (inv.invoiceNumber ?? '').toLowerCase().includes(search);
      return matchText && (!this.showOnlyAnomalies || inv.hasAnomalies);
    });
  }

  toggleAnomalies(): void { this.showOnlyAnomalies = !this.showOnlyAnomalies; this.applyFilter(); }

  goToDetail(inv: Invoice): void { this.router.navigate(['/invoices', inv.id]); }
}
