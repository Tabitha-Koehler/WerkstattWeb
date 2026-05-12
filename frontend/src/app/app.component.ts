import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'WerkstattWeb';

  navItems = [
    { path: '/dashboard', icon: 'dashboard',      label: 'Dashboard'     },
    { path: '/vehicles',  icon: 'local_shipping',  label: 'Fahrzeuge'     },
    { path: '/invoices',  icon: 'receipt_long',    label: 'Rechnungen'    },
    { path: '/warehouse', icon: 'warehouse',        label: 'Lager'         },
    { path: '/upload',    icon: 'upload_file',      label: 'Hochladen'     },
  ];

  constructor(public router: Router) {}
}
