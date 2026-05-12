import { Component, inject, input, output, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Vehicle } from '../../core/models/models';

@Component({
  standalone: true,
  selector: 'app-vehicle-dialog',
  imports: [ReactiveFormsModule, ButtonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
         style="background:rgba(0,0,0,0.6); backdrop-filter:blur(4px)"
         (click)="cancel.emit()">
      <div class="w-full max-w-md rounded-2xl shadow-2xl"
           style="background:var(--surface-card); border:1px solid var(--surface-border)"
           (click)="$event.stopPropagation()">

        <div class="flex items-center justify-between px-6 py-4 border-b"
             style="border-color:var(--surface-border)">
          <h2 class="font-semibold text-base" style="color:var(--surface-text)">
            {{ vehicle() ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug' }}
          </h2>
          <p-button icon="fa-solid fa-xmark" [text]="true" [rounded]="true"
                    severity="secondary" size="small" (click)="cancel.emit()" />
        </div>

        <form [formGroup]="form" class="px-6 py-5 space-y-4">
          <div>
            <label class="form-label">Kennzeichen *</label>
            <input class="form-input" formControlName="licensePlate"
                   placeholder="HH-AB-1234" autocomplete="off">
          </div>
          <div>
            <label class="form-label">Fahrzeugtyp</label>
            <select class="form-select" formControlName="vehicleType">
              <option value="">– Auswählen –</option>
              <option>LKW</option><option>Sattelzugmaschine</option>
              <option>Anhänger</option><option>Auflieger</option>
              <option>PKW</option><option>Transporter</option><option>Sonstig</option>
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

        <div class="flex justify-end gap-3 px-6 py-4 border-t"
             style="border-color:var(--surface-border)">
          <p-button label="Abbrechen" severity="secondary" [outlined]="true" (click)="cancel.emit()" />
          <p-button label="Speichern" icon="fa-solid fa-check"
                    [disabled]="form.invalid" (click)="save()" />
        </div>
      </div>
    </div>
  `,
})
export class VehicleDialogComponent implements OnInit {
  private fb = inject(FormBuilder);

  vehicle = input<Vehicle | null>(null);
  saved   = output<Partial<Vehicle>>();
  cancel  = output<void>();

  form!: FormGroup;

  ngOnInit(): void {
    const v = this.vehicle();
    this.form = this.fb.group({
      licensePlate: [v?.licensePlate ?? '', Validators.required],
      vehicleType:  [v?.vehicleType  ?? ''],
      manufacturer: [v?.manufacturer ?? ''],
      model:        [v?.model        ?? ''],
      year:         [v?.year         ?? null],
      notes:        [v?.notes        ?? ''],
    });
  }

  save(): void { if (this.form.valid) this.saved.emit(this.form.value); }
}
