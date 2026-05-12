import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Vehicle } from '../../core/models/models';

@Component({
  selector: 'app-vehicle-dialog',
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" (click)="onBackdrop($event)">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-semibold text-gray-900">{{ vehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug' }}</h2>
          <button class="btn-icon" (click)="cancel.emit()">✕</button>
        </div>

        <form [formGroup]="form" class="p-6 space-y-4">
          <div>
            <label class="form-label">Kennzeichen *</label>
            <input class="form-input" formControlName="licensePlate" placeholder="HH-AB-1234">
          </div>
          <div>
            <label class="form-label">Fahrzeugtyp</label>
            <select class="form-select" formControlName="vehicleType">
              <option value="">– Auswählen –</option>
              <option>LKW</option>
              <option>Sattelzugmaschine</option>
              <option>Anhänger</option>
              <option>Auflieger</option>
              <option>PKW</option>
              <option>Transporter</option>
              <option>Sonstig</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Hersteller</label>
              <input class="form-input" formControlName="manufacturer" placeholder="z.B. MAN">
            </div>
            <div>
              <label class="form-label">Modell</label>
              <input class="form-input" formControlName="model" placeholder="z.B. TGX 18.500">
            </div>
          </div>
          <div>
            <label class="form-label">Baujahr</label>
            <input class="form-input" formControlName="year" type="number" placeholder="2019">
          </div>
          <div>
            <label class="form-label">Notizen</label>
            <textarea class="form-input" formControlName="notes" rows="2"></textarea>
          </div>
        </form>

        <div class="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button class="btn-secondary" (click)="cancel.emit()">Abbrechen</button>
          <button class="btn-primary" [disabled]="form.invalid" (click)="save()">Speichern</button>
        </div>
      </div>
    </div>
  `,
})
export class VehicleDialogComponent implements OnInit {
  @Input() vehicle: Vehicle | null = null;
  @Output() saved = new EventEmitter<Partial<Vehicle>>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.form = this.fb.group({
      licensePlate: [this.vehicle?.licensePlate ?? '', Validators.required],
      vehicleType:  [this.vehicle?.vehicleType  ?? ''],
      manufacturer: [this.vehicle?.manufacturer ?? ''],
      model:        [this.vehicle?.model        ?? ''],
      year:         [this.vehicle?.year         ?? null],
      notes:        [this.vehicle?.notes        ?? ''],
    });
  }

  save() { if (this.form.valid) this.saved.emit(this.form.value); }
  onBackdrop(e: Event) { this.cancel.emit(); }
}
