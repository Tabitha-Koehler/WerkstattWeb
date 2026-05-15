import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: 'vehicles',
    loadComponent: () => import('./vehicles/vehicle-list/vehicle-list.component').then(m => m.VehicleListComponent),
  },
  {
    path: 'vehicles/:id',
    loadComponent: () => import('./vehicles/vehicle-detail/vehicle-detail.component').then(m => m.VehicleDetailComponent),
  },
  {
    path: 'invoices',
    loadComponent: () => import('./invoices/invoice-list/invoice-list.component').then(m => m.InvoiceListComponent),
  },
  {
    path: 'invoices/:id',
    loadComponent: () => import('./invoices/invoice-detail/invoice-detail.component').then(m => m.InvoiceDetailComponent),
  },
  {
    path: 'warehouse',
    loadComponent: () => import('./warehouse/warehouse.component').then(m => m.WarehouseComponent),
  },
  {
    path: 'upload',
    loadComponent: () => import('./upload/upload.component').then(m => m.UploadComponent),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/analytics.component').then(m => m.AnalyticsComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
