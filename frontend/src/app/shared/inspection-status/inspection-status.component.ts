import { Component, Input } from '@angular/core';
import { Inspection } from '../../core/models/models';

@Component({
  selector: 'app-inspection-status',
  template: `
    <div *ngIf="inspection; else noData">
      <span [class]="statusClass">{{ statusIcon }} {{ inspection.type }}</span>
      <div style="font-size:12px; color:#616161; margin-top:2px;">
        <span *ngIf="inspection.inspectionDate">Datum: {{ inspection.inspectionDate | date:'dd.MM.yyyy' }}</span>
        <span *ngIf="inspection.nextDueDate"> · Fällig: <strong [class]="statusClass">{{ inspection.nextDueDate | date:'dd.MM.yyyy' }}</strong></span>
      </div>
    </div>
    <ng-template #noData>
      <span class="status-unknown">{{ type }} – Kein Eintrag</span>
    </ng-template>
  `,
})
export class InspectionStatusComponent {
  @Input() inspection: Inspection | null = null;
  @Input() type: string = '';

  get daysUntilDue(): number | null {
    if (!this.inspection?.nextDueDate) return null;
    const due = new Date(this.inspection.nextDueDate);
    const today = new Date();
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  get statusClass(): string {
    const days = this.daysUntilDue;
    if (days === null) return 'status-unknown';
    if (days < 0)  return 'status-overdue';
    if (days <= 30) return 'status-soon';
    return 'status-ok';
  }

  get statusIcon(): string {
    const days = this.daysUntilDue;
    if (days === null) return '❓';
    if (days < 0)  return '🔴';
    if (days <= 30) return '🟠';
    return '🟢';
  }
}
