import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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

  categoryLabels: Record<string, string> = {
    REPAIR: 'Reparatur', INSPECTION: 'Prüfung', BETRIEBSMITTEL: 'Betriebsmittel',
    LABOR: 'Lohnkosten', PARTS: 'Ersatzteile', TOOLS: 'Werkzeug', OTHER: 'Sonstiges',
  };

  categoryColors: Record<string, string> = {
    REPAIR: '#dbeafe', INSPECTION: '#dcfce7', BETRIEBSMITTEL: '#ffedd5',
    LABOR: '#f3e8ff', PARTS: '#ccfbf1', TOOLS: '#fee2e2', OTHER: '#f9fafb',
  };

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private api: ApiService,
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
        alert('Rechnung nicht gefunden');
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
      next: () => { this.router.navigate(['/invoices']); },
    });
  }
}
