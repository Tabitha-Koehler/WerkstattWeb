import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
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

  // Incrementing this signal triggers a reload of the resource
  private reloadTrigger = signal(0);

  private vehiclesRes = rxResource({
    params: () => this.reloadTrigger(),
    stream: () => this.api.getVehicles(),
  });

  vehicles     = computed(() => this.vehiclesRes.value() ?? [] as Vehicle[]);
  loading      = computed(() => this.vehiclesRes.isLoading());
  errorMsg     = signal('');
  dialogOpen   = signal(false);
  editingVehicle = signal<Vehicle | null>(null);

  openDialog(vehicle?: Vehicle): void {
    this.editingVehicle.set(vehicle ?? null);
    this.dialogOpen.set(true);
  }

  onSaved(data: Partial<Vehicle>): void {
    const obs = this.editingVehicle()
      ? this.api.updateVehicle(this.editingVehicle()!.id, data)
      : this.api.createVehicle(data);
    obs.subscribe({
      next: () => { this.dialogOpen.set(false); this.reload(); },
      error: err => this.errorMsg.set(err?.error?.message ?? 'Fehler beim Speichern'),
    });
  }

  delete(v: Vehicle, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Fahrzeug ${v.licensePlate} wirklich löschen?`)) return;
    this.api.deleteVehicle(v.id).subscribe({ next: () => this.reload() });
  }

  reload(): void { this.reloadTrigger.update(n => n + 1); }
  goToDetail(v: Vehicle): void { this.router.navigate(['/vehicles', v.id]); }
}
