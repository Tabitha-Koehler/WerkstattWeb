import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Vehicle } from '../../core/models/models';

@Component({
  selector: 'app-vehicle-dialog',
  template: `
    <h2 mat-dialog-title>{{ data ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug' }}</h2>
    <mat-dialog-content [formGroup]="form" style="display:flex; flex-direction:column; gap:8px; min-width:400px;">
      <mat-form-field appearance="outline">
        <mat-label>Kennzeichen *</mat-label>
        <input matInput formControlName="licensePlate" placeholder="HH-AB-1234">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Fahrzeugtyp</mat-label>
        <mat-select formControlName="vehicleType">
          <mat-option value="LKW">LKW</mat-option>
          <mat-option value="Sattelzugmaschine">Sattelzugmaschine</mat-option>
          <mat-option value="Anhänger">Anhänger</mat-option>
          <mat-option value="Auflieger">Auflieger</mat-option>
          <mat-option value="PKW">PKW</mat-option>
          <mat-option value="Transporter">Transporter</mat-option>
          <mat-option value="Sonstig">Sonstig</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Hersteller</mat-label>
        <input matInput formControlName="manufacturer" placeholder="z.B. MAN, Mercedes, DAF">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Modell</mat-label>
        <input matInput formControlName="model" placeholder="z.B. TGX 18.500">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Baujahr</mat-label>
        <input matInput formControlName="year" type="number" placeholder="2019">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Notizen</mat-label>
        <textarea matInput formControlName="notes" rows="2"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Abbrechen</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="save()">Speichern</button>
    </mat-dialog-actions>
  `,
})
export class VehicleDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<VehicleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Vehicle | null,
  ) {
    this.form = this.fb.group({
      licensePlate: [data?.licensePlate ?? '', Validators.required],
      vehicleType:  [data?.vehicleType  ?? ''],
      manufacturer: [data?.manufacturer ?? ''],
      model:        [data?.model        ?? ''],
      year:         [data?.year         ?? null],
      notes:        [data?.notes        ?? ''],
    });
  }

  save(): void {
    if (this.form.valid) this.dialogRef.close(this.form.value);
  }
}
