import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { VehicleListComponent } from './vehicles/vehicle-list/vehicle-list.component';
import { VehicleDetailComponent } from './vehicles/vehicle-detail/vehicle-detail.component';
import { VehicleDialogComponent } from './vehicles/vehicle-dialog/vehicle-dialog.component';
import { InvoiceListComponent } from './invoices/invoice-list/invoice-list.component';
import { InvoiceDetailComponent } from './invoices/invoice-detail/invoice-detail.component';
import { WarehouseComponent } from './warehouse/warehouse.component';
import { UploadComponent } from './upload/upload.component';
import { InspectionStatusComponent } from './shared/inspection-status/inspection-status.component';
import { PdfViewerModule } from 'ng2-pdf-viewer';

@NgModule({
  declarations: [
    AppComponent,
    DashboardComponent,
    VehicleListComponent,
    VehicleDetailComponent,
    VehicleDialogComponent,
    InvoiceListComponent,
    InvoiceDetailComponent,
    WarehouseComponent,
    UploadComponent,
    InspectionStatusComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AppRoutingModule,
    PdfViewerModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
