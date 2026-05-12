import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ApiService } from '../../core/services/api.service';
import { Vehicle } from '../../core/models/models';
import { VehicleDialogComponent } from '../vehicle-dialog/vehicle-dialog.component';

@Component({
  standalone: true,
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  imports: [ButtonModule, TooltipModule, VehicleDialogComponent],
})
export class VehicleListComponent {
  private api    = inject(ApiService);
  private router = inject(Router);

  vehicles     = signal<Vehicle[]>([]);
  loading      = signal(true);
  errorMsg     = signal('');
  dialogOpen   = signal(false);
  editingVehicle = signal<Vehicle | null>(null);

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.getVehicles().subscribe({
      next: v => { this.vehicles.set(v); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openDialog(vehicle?: Vehicle): void {
    this.editingVehicle.set(vehicle ?? null);
    this.dialogOpen.set(true);
  }

  onSaved(data: Partial<Vehicle>): void {
    const obs = this.editingVehicle()
      ? this.api.updateVehicle(this.editingVehicle()!.id, data)
      : this.api.createVehicle(data);
    obs.subscribe({
      next: () => { this.dialogOpen.set(false); this.load(); },
      error: err => this.errorMsg.set(err?.error?.message ?? 'Fehler beim Speichern'),
    });
  }

  delete(v: Vehicle, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Fahrzeug ${v.licensePlate} wirklich löschen?`)) return;
    this.api.deleteVehicle(v.id).subscribe({ next: () => this.load() });
  }

  goToDetail(v: Vehicle): void { this.router.navigate(['/vehicles', v.id]); }
}
