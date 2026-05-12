import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { Invoice } from '../core/models/models';

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  result?: Invoice;
  error?: string;
}

@Component({
  selector: 'app-upload',
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss'],
})
export class UploadComponent {
  queue: UploadItem[] = [];
  dragOver = false;
  uploading = false;

  constructor(private api: ApiService, private router: Router) {}

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
  }

  addFiles(files: File[]): void {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    pdfs.forEach(f => this.queue.push({ file: f, status: 'pending' }));
  }

  removeItem(idx: number): void { this.queue.splice(idx, 1); }

  async uploadAll(): Promise<void> {
    const pending = this.queue.filter(i => i.status === 'pending');
    if (!pending.length) return;
    this.uploading = true;

    for (const item of pending) {
      item.status = 'uploading';
      try {
        item.result = await this.api.uploadInvoice(item.file).toPromise();
        item.status = 'done';
      } catch (err: any) {
        item.status = 'error';
        item.error = err?.error?.message ?? err?.message ?? 'Unbekannter Fehler';
      }
    }
    this.uploading = false;
  }

  goToResult(item: UploadItem): void {
    if (item.result) {
      this.router.navigate(item.result.isWarehouse ? ['/warehouse'] : ['/invoices', item.result.id]);
    }
  }

  pendingCount(): number { return this.queue.filter(i => i.status === 'pending').length; }
  doneCount(): number   { return this.queue.filter(i => i.status === 'done').length; }
  errorCount(): number  { return this.queue.filter(i => i.status === 'error').length; }
}
