import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
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

  constructor(
    private api: ApiService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver = false;
    const files = Array.from(e.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.addFiles(files);
    input.value = '';
  }

  addFiles(files: File[]): void {
    const pdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length !== files.length) {
      this.snackBar.open('Nur PDF-Dateien werden akzeptiert', '', { duration: 3000 });
    }
    pdfs.forEach(f => this.queue.push({ file: f, status: 'pending' }));
  }

  removeItem(idx: number): void {
    this.queue.splice(idx, 1);
  }

  async uploadAll(): Promise<void> {
    const pending = this.queue.filter(i => i.status === 'pending');
    if (!pending.length) return;
    this.uploading = true;

    for (const item of pending) {
      item.status = 'uploading';
      try {
        const result = await this.api.uploadInvoice(item.file).toPromise();
        item.status = 'done';
        item.result = result;
      } catch (err: any) {
        item.status = 'error';
        item.error = err?.error?.message ?? err?.message ?? 'Unbekannter Fehler';
      }
    }

    this.uploading = false;
    const done = this.queue.filter(i => i.status === 'done').length;
    const errors = this.queue.filter(i => i.status === 'error').length;
    this.snackBar.open(
      `${done} Rechnung(en) verarbeitet${errors > 0 ? `, ${errors} Fehler` : ''}`,
      '',
      { duration: 4000 },
    );
  }

  goToResult(item: UploadItem): void {
    if (item.result) {
      const path = item.result.isWarehouse ? '/warehouse' : `/invoices/${item.result.id}`;
      this.router.navigate([path]);
    }
  }

  pendingCount(): number { return this.queue.filter(i => i.status === 'pending').length; }
  doneCount(): number   { return this.queue.filter(i => i.status === 'done').length; }
  errorCount(): number  { return this.queue.filter(i => i.status === 'error').length; }
}
