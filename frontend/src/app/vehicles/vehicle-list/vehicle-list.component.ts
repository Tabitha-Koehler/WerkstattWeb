import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Vehicle } from '../../core/models/models';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.scss'],
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  loading = true;
  dialogOpen = false;
  editingVehicle: Vehicle | null = null;
  errorMsg = '';

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.api.getVehicles().subscribe({
      next: v => { this.vehicles = v; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  openDialog(vehicle?: Vehicle): void {
    this.editingVehicle = vehicle ?? null;
    this.dialogOpen = true;
  }

  onSaved(data: Partial<Vehicle>): void {
    const obs = this.editingVehicle
      ? this.api.updateVehicle(this.editingVehicle.id, data)
      : this.api.createVehicle(data);
    obs.subscribe({
      next: () => { this.dialogOpen = false; this.load(); },
      error: err => this.errorMsg = err?.error?.message ?? 'Fehler beim Speichern',
    });
  }

  delete(v: Vehicle, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Fahrzeug ${v.licensePlate} wirklich löschen?`)) return;
    this.api.deleteVehicle(v.id).subscribe({ next: () => this.load() });
  }

  goToDetail(v: Vehicle): void { this.router.navigate(['/vehicles', v.id]); }
}
