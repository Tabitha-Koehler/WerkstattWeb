import { Component, Input } from '@angular/core';
import { Inspection } from '../../core/models/models';

@Component({
  standalone: false,
  selector: 'app-inspection-status',
  template: `
    @if (inspection) {
      <div>
        <span [class]="statusClass">
          <i class="fa-solid {{ statusIcon }} mr-1"></i>{{ inspection.type }}
        </span>
        <div class="text-xs text-gray-500 mt-0.5">
          @if (inspection.inspectionDate) {
            <span>Datum: {{ inspection.inspectionDate | date:'dd.MM.yyyy' }}</span>
          }
          @if (inspection.nextDueDate) {
            <span> · Fällig: <strong [class]="statusClass">{{ inspection.nextDueDate | date:'dd.MM.yyyy' }}</strong></span>
          }
        </div>
      </div>
    } @else {
      <span class="status-unknown">{{ type }} – Kein Eintrag</span>
    }
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
    if (days < 0)   return 'status-overdue';
    if (days <= 30) return 'status-soon';
    return 'status-ok';
  }

  get statusIcon(): string {
    const days = this.daysUntilDue;
    if (days === null) return 'fa-question';
    if (days < 0)   return 'fa-circle-xmark';
    if (days <= 30) return 'fa-circle-exclamation';
    return 'fa-circle-check';
  }
}
