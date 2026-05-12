import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { Vehicle } from '../../core/models/models';
import { VehicleDialogComponent } from '../vehicle-dialog/vehicle-dialog.component';

@Component({
  selector: 'app-vehicle-list',
  templateUrl: './vehicle-list.component.html',
  styleUrls: ['./vehicle-list.component.scss'],
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  loading = true;
  displayedColumns = ['licensePlate', 'vehicleType', 'manufacturer', 'model', 'year', 'actions'];

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.api.getVehicles().subscribe({
      next: v => { this.vehicles = v; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openDialog(vehicle?: Vehicle): void {
    const ref = this.dialog.open(VehicleDialogComponent, {
      width: '480px', data: vehicle ? { ...vehicle } : null,
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const obs = vehicle
        ? this.api.updateVehicle(vehicle.id, result)
        : this.api.createVehicle(result);
      obs.subscribe({
        next: () => { this.snackBar.open('Gespeichert', '', { duration: 2000 }); this.load(); },
        error: err => this.snackBar.open('Fehler: ' + (err.error?.message || err.message), '', { duration: 4000 }),
      });
    });
  }

  delete(v: Vehicle, event: Event): void {
    event.stopPropagation();
    if (!confirm(`Fahrzeug ${v.licensePlate} wirklich löschen?`)) return;
    this.api.deleteVehicle(v.id).subscribe({
      next: () => { this.snackBar.open('Gelöscht', '', { duration: 2000 }); this.load(); },
      error: () => this.snackBar.open('Fehler beim Löschen', '', { duration: 3000 }),
    });
  }

  goToDetail(v: Vehicle): void {
    this.router.navigate(['/vehicles', v.id]);
  }
}
