import { Component, input, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Inspection } from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-inspection-status',
  imports: [DatePipe],
  template: `
    @if (inspection()) {
      <div>
        <span [class]="statusClass()">
          <i class="fa-solid {{ statusIcon() }} mr-1"></i>{{ inspection()!.type }}
        </span>
        <div class="text-xs text-gray-500 mt-0.5">
          @if (inspection()!.inspectionDate) {
            <span>Datum: {{ inspection()!.inspectionDate | date:'dd.MM.yyyy' }}</span>
          }
          @if (inspection()!.nextDueDate) {
            <span> · Fällig:
              <strong [class]="statusClass()">
                {{ inspection()!.nextDueDate | date:'dd.MM.yyyy' }}
              </strong>
            </span>
          }
        </div>
      </div>
    } @else {
      <span class="status-unknown">{{ type() }} – Kein Eintrag</span>
    }
  `,
})
export class InspectionStatusComponent {
  inspection = input<Inspection | null>(null);
  type       = input<string>('');

  private daysUntilDue = computed(() => {
    const due = this.inspection()?.nextDueDate;
    if (!due) return null;
    return Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000);
  });

  statusClass = computed(() => {
    const d = this.daysUntilDue();
    if (d === null) return 'status-unknown';
    if (d < 0)     return 'status-overdue';
    if (d <= 30)   return 'status-soon';
    return 'status-ok';
  });

  statusIcon = computed(() => {
    const d = this.daysUntilDue();
    if (d === null) return 'fa-question';
    if (d < 0)     return 'fa-circle-xmark';
    if (d <= 30)   return 'fa-circle-exclamation';
    return 'fa-circle-check';
  });
}
