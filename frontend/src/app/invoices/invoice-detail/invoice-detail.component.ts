import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { ApiService } from '../../core/services/api.service';

@Component({
  standalone: true,

  selector: 'app-invoice-detail',
  templateUrl: './invoice-detail.component.html',
  imports: [DatePipe, CurrencyPipe, ButtonModule, TagModule, TooltipModule, TableModule, PdfViewerModule],
})
export class InvoiceDetailComponent {
  readonly router = inject(Router);
  private  route  = inject(ActivatedRoute);
  private  api    = inject(ApiService);

  // Dynamisch auf Routen-Änderungen reagieren (kein snapshot!)
  invoice = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('id')!),
      switchMap(id => this.api.getInvoice(id))
    )
  );

  loading = computed(() => this.invoice() === undefined);
  showPdf = signal(false);
  pdfUrl  = computed(() => this.invoice() ? this.api.getPdfUrl(this.invoice()!.id) : '');

  readonly categoryLabels: Record<string, string> = {
    REPAIR: 'Reparatur', INSPECTION: 'Prüfung', BETRIEBSMITTEL: 'Betriebsmittel',
    LABOR: 'Lohnkosten', PARTS: 'Ersatzteile', TOOLS: 'Werkzeug', OTHER: 'Sonstiges',
  };

  readonly categoryColors: Record<string, string> = {
    REPAIR: '#dbeafe', INSPECTION: '#dcfce7', BETRIEBSMITTEL: '#ffedd5',
    LABOR: '#f3e8ff', PARTS: '#ccfbf1', TOOLS: '#fee2e2', OTHER: '#f9fafb',
  };

  deleteInvoice(): void {
    if (!confirm('Rechnung wirklich löschen?')) return;
    this.api.deleteInvoice(this.invoice()!.id).subscribe({
      next: () => this.router.navigate(['/invoices']),
    });
  }
}
