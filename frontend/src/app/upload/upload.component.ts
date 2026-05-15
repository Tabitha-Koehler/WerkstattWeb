import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ApiService } from '../core/services/api.service';
import { Invoice } from '../core/models/models';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: Invoice;
  error?: string;
}

@Component({
  standalone: true,
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  imports: [CurrencyPipe, ButtonModule, TagModule, ProgressBarModule],
})
export class UploadComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  queue: UploadItem[] = [];
  dragOver = false;
  uploading = false;

  get pendingCount() { return this.queue.filter(i => i.status === 'pending').length; }
  get doneCount()    { return this.queue.filter(i => i.status === 'done').length; }
  get errorCount()   { return this.queue.filter(i => i.status === 'error').length; }

  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragOver = true; }
  onDragLeave(): void { this.dragOver = false; }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = false;
    this.addFiles(Array.from(e.dataTransfer?.files ?? []));
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
    this.cdr.detectChanges();
  }

  addFiles(files: File[]): void {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    this.queue = [...this.queue, ...pdfs.map(f => ({ file: f, status: 'pending' as const }))];
    this.cdr.detectChanges();
  }

  removeItem(idx: number): void {
    this.queue = this.queue.filter((_, i) => i !== idx);
  }

  async uploadAll(): Promise<void> {
    const pending = this.queue.filter(i => i.status === 'pending');
    if (!pending.length) return;
    this.uploading = true;

    for (const item of pending) {
      this.updateItem(item, { status: 'uploading' });
      try {
        const result = await this.api.uploadInvoice(item.file).toPromise();
        this.updateItem(item, { status: 'done', result });
      } catch (err: any) {
        this.updateItem(item, { status: 'error', error: err?.error?.message ?? err?.message ?? 'Fehler' });
      }
    }
    this.uploading = false;
    this.cdr.detectChanges();
  }

  private updateItem(item: UploadItem, patch: Partial<UploadItem>): void {
    this.queue = this.queue.map(i => i === item ? { ...i, ...patch } : i);
    this.cdr.detectChanges();
  }

  goToResult(item: UploadItem): void {
    if (item.result) {
      this.router.navigate(item.result.isWarehouse ? ['/warehouse'] : ['/invoices', item.result.id]);
    }
  }

  statusIconClass(status: string, hasAnomalies?: boolean): string {
    if (status === 'pending')              return 'bg-slate-100 text-slate-400 dark:bg-slate-700';
    if (status === 'uploading')            return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40';
    if (status === 'error')                return 'bg-red-100 text-red-600 dark:bg-red-900/40';
    if (status === 'done' && hasAnomalies) return 'bg-amber-100 text-amber-600';
    return 'bg-emerald-100 text-emerald-600';
  }

  statusFaIcon(status: string, hasAnomalies?: boolean): string {
    if (status === 'pending')              return 'fa-clock';
    if (status === 'uploading')            return 'fa-spinner fa-spin';
    if (status === 'error')                return 'fa-circle-xmark';
    if (status === 'done' && hasAnomalies) return 'fa-triangle-exclamation';
    return 'fa-circle-check';
  }
}
