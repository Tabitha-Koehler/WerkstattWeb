import { Component } from '@angular/core';
import { ThemeService } from './core/services/theme.service';

interface NavItem {
  path: string;
  icon: string;
  label: string;
}

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  readonly navItems: NavItem[] = [
    { path: '/dashboard', icon: 'fa-gauge-high',    label: 'Dashboard'  },
    { path: '/vehicles',  icon: 'fa-truck',         label: 'Fahrzeuge'  },
    { path: '/invoices',  icon: 'fa-receipt',       label: 'Rechnungen' },
    { path: '/warehouse', icon: 'fa-warehouse',     label: 'Lager'      },
    { path: '/upload',    icon: 'fa-cloud-arrow-up',label: 'Hochladen'  },
  ];

  constructor(public theme: ThemeService) {}
}
