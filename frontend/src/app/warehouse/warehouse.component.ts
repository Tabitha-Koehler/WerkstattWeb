import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { Invoice } from '../core/models/models';

@Component({
  standalone: false,
  selector: 'app-warehouse',
  templateUrl: './warehouse.component.html',
  styleUrls: ['./warehouse.component.scss'],
})
export class WarehouseComponent implements OnInit {
  invoices: Invoice[] = [];
  loading = true;
  displayedColumns = ['invoiceDate', 'workshopName', 'repairContext', 'totalAmount', 'status'];

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.api.getInvoices(undefined, true).subscribe({
      next: inv => { this.invoices = inv; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  totalCost(): number {
    return this.invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  }

  goToDetail(inv: Invoice): void {
    this.router.navigate(['/invoices', inv.id]);
  }
}
