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
    { path: '/dashboard', icon: '▦',  label: 'Dashboard'  },
    { path: '/vehicles',  icon: '🚛', label: 'Fahrzeuge'  },
    { path: '/invoices',  icon: '🧾', label: 'Rechnungen' },
    { path: '/warehouse', icon: '🏭', label: 'Lager'      },
    { path: '/upload',    icon: '⬆️', label: 'Hochladen'  },
  ];

  constructor(public theme: ThemeService) {}
}
