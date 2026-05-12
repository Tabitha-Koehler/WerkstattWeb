import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';
import { Invoice } from '../../core/models/models';

@Component({
  selector: 'app-invoice-detail',
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.scss'],
})
export class InvoiceDetailComponent implements OnInit {
  invoice: Invoice | null = null;
  loading = true;
  showPdf = false;
  pdfUrl = '';

  positionColumns = ['pos', 'description', 'quantity', 'unitPrice', 'totalPrice', 'category', 'anomaly'];

  categoryLabels: Record<string, string> = {
    REPAIR: 'Reparatur', INSPECTION: 'Prüfung', BETRIEBSMITTEL: 'Betriebsmittel',
    LABOR: 'Lohnkosten', PARTS: 'Ersatzteile', TOOLS: 'Werkzeug', OTHER: 'Sonstiges',
  };

  categoryColors: Record<string, string> = {
    REPAIR: '#e3f2fd', INSPECTION: '#e8f5e9', BETRIEBSMITTEL: '#fff3e0',
    LABOR: '#f3e5f5', PARTS: '#e0f2f1', TOOLS: '#ffebee', OTHER: '#fafafa',
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private api: ApiService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.getInvoice(id).subscribe({
      next: inv => {
        this.invoice = inv;
        this.pdfUrl = this.api.getPdfUrl(id);
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Rechnung nicht gefunden', '', { duration: 3000 });
        this.router.navigate(['/invoices']);
      },
    });
  }

  anomalies() {
    return this.invoice?.positions?.filter(p => p.isAnomaly) ?? [];
  }

  inspectionPositions() {
    return this.invoice?.inspections ?? [];
  }

  supplies() {
    return this.invoice?.operatingSupplies ?? [];
  }

  deleteInvoice(): void {
    if (!confirm('Rechnung wirklich löschen?')) return;
    this.api.deleteInvoice(this.invoice!.id).subscribe({
      next: () => {
        this.snackBar.open('Rechnung gelöscht', '', { duration: 2000 });
        this.router.navigate(['/invoices']);
      },
    });
  }
}
