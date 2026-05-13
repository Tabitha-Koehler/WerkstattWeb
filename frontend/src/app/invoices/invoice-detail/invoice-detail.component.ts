import { Component, inject, signal, computed, resource } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { ApiService } from '../../core/services/api.service';

@Component({
  standalone: true,
  selector: 'app-invoice-detail',
  templateUrl: './invoice-detail.component.html',
  imports: [DatePipe, CurrencyPipe, ButtonModule, TagModule, TooltipModule, PdfViewerModule],
})
export class InvoiceDetailComponent {
  readonly router = inject(Router);
  private  route  = inject(ActivatedRoute);
  private  api    = inject(ApiService);

  private id = this.route.snapshot.paramMap.get('id')!;

  private invoiceRes = resource({ loader: () => firstValueFrom(this.api.getInvoice(this.id)) });

  invoice  = computed(() => this.invoiceRes.value());
  loading  = computed(() => this.invoiceRes.isLoading());
  showPdf  = signal(false);
  pdfUrl   = this.api.getPdfUrl(this.id);

  anomalies           = computed(() => this.invoice()?.positions?.filter(p => p.isAnomaly) ?? []);
  inspectionPositions = computed(() => this.invoice()?.inspections ?? []);
  supplies            = computed(() => this.invoice()?.operatingSupplies ?? []);

  detailRows = computed(() => {
    const inv = this.invoice();
    if (!inv) return [];
    return [
      { label: 'Werkstatt',     value: inv.workshopName ?? '–' },
      { label: 'Rechnungs-Nr.', value: inv.invoiceNumber ?? '–' },
      { label: 'Datum',         value: new Date(inv.invoiceDate).toLocaleDateString('de-DE') },
      { label: 'Kennzeichen',   value: inv.vehicle?.licensePlate ?? 'Lager' },
      { label: 'Reparatur',     value: inv.repairContext ?? '–' },
    ];
  });

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
