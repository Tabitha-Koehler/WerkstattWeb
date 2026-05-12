import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ZoneInterceptor } from './core/interceptors/zone.interceptor';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

// PrimeNG Module
import { ButtonModule }       from 'primeng/button';
import { CardModule }         from 'primeng/card';
import { TableModule }        from 'primeng/table';
import { TagModule }          from 'primeng/tag';
import { BadgeModule }        from 'primeng/badge';
import { ProgressBarModule }  from 'primeng/progressbar';
import { InputTextModule }    from 'primeng/inputtext';
import { DialogModule }       from 'primeng/dialog';
import { ToastModule }        from 'primeng/toast';
import { ToolbarModule }      from 'primeng/toolbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule }    from 'primeng/iconfield';
import { InputIconModule }    from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';

// ng2-pdf-viewer
import { PdfViewerModule } from 'ng2-pdf-viewer';

// App Komponenten
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
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AppRoutingModule,
    PdfViewerModule,
    // PrimeNG
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    BadgeModule,
    ProgressBarModule,
    InputTextModule,
    DialogModule,
    ToastModule,
    ToolbarModule,
    ConfirmDialogModule,
    IconFieldModule,
    InputIconModule,
  ],
  providers: [
    provideHttpClient(),
    { provide: HTTP_INTERCEPTORS, useClass: ZoneInterceptor, multi: true },
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
          cssLayer: { name: 'primeng', order: 'tailwind-base, primeng, tailwind-utilities' },
        },
      },
    }),
    MessageService,
    ConfirmationService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
