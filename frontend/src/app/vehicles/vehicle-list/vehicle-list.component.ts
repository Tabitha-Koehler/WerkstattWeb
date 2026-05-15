import { Component, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
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

  reloadTrigger = signal(0);

  // Direct signal via toObservable + switchMap for reload support
  allVehicles = toSignal(
    toObservable(this.reloadTrigger).pipe(switchMap(() => this.api.getVehicles()))
  );

  vehicles       = computed(() => this.allVehicles() ?? [] as Vehicle[]);
  loading        = computed(() => this.allVehicles() === undefined);
  errorMsg       = signal('');
  dialogOpen     = signal(false);
  editingVehicle = signal<Vehicle | null>(null);

  enriching     = signal(false);
  enrichResult  = signal<string | null>(null);

  enrichAllFromInvoices(): void {
    if (this.enriching()) return;
    this.enriching.set(true);
    this.enrichResult.set(null);
    this.api.enrichAllVehiclesFromInvoices().subscribe({
      next: (res) => {
        this.enriching.set(false);
        if (res.updated > 0) {
          this.enrichResult.set(`✓ ${res.updated} Fahrzeug(e) aktualisiert`);
          this.reload();
        } else {
          this.enrichResult.set('Keine neuen Daten gefunden');
        }
      },
      error: () => { this.enriching.set(false); this.enrichResult.set('Fehler'); },
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
