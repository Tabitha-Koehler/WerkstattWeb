import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { ApiService } from '../../core/services/api.service';
import { Invoice } from '../../core/models/models';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss'],
})
export class InvoiceListComponent implements OnInit {
  dataSource = new MatTableDataSource<Invoice>();
  loading = true;
  filter = '';
  showOnlyAnomalies = false;

  displayedColumns = ['invoiceDate', 'licensePlate', 'workshopName', 'repairContext', 'totalAmount', 'status'];

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getInvoices(undefined, false).subscribe({
      next: invoices => {
        this.dataSource.data = invoices;
        this.dataSource.sort = this.sort;
        this.dataSource.paginator = this.paginator;
        this.dataSource.filterPredicate = this.buildFilterPredicate();
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  buildFilterPredicate() {
    return (inv: Invoice, filterStr: string): boolean => {
      const search = filterStr.toLowerCase();
      const matchesText =
        (inv.vehicle?.licensePlate ?? '').toLowerCase().includes(search) ||
        (inv.workshopName ?? '').toLowerCase().includes(search) ||
        (inv.repairContext ?? '').toLowerCase().includes(search) ||
        (inv.invoiceNumber ?? '').toLowerCase().includes(search);
      const matchesAnomaly = !this.showOnlyAnomalies || inv.hasAnomalies;
      return matchesText && matchesAnomaly;
    };
  }

  applyFilter(): void {
    this.dataSource.filter = this.filter + (this.showOnlyAnomalies ? '_anomaly' : '');
  }

  toggleAnomalies(): void {
    this.showOnlyAnomalies = !this.showOnlyAnomalies;
    this.applyFilter();
  }

  goToDetail(inv: Invoice): void {
    this.router.navigate(['/invoices', inv.id]);
  }
}
