import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ThemeService } from './core/services/theme.service';

@Component({
  standalone: true,

  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ConfirmDialogModule],
})
export class AppComponent {
  readonly theme = inject(ThemeService);

  readonly navItems = [
    { path: '/dashboard', icon: 'fa-gauge-high',     label: 'Dashboard'   },
    { path: '/vehicles',  icon: 'fa-truck',          label: 'Fahrzeuge'   },
    { path: '/invoices',  icon: 'fa-receipt',        label: 'Rechnungen'  },
    { path: '/warehouse', icon: 'fa-warehouse',      label: 'Lager'       },
    { path: '/analytics', icon: 'fa-chart-bar',      label: 'Auswertungen'},
    { path: '/upload',    icon: 'fa-cloud-arrow-up', label: 'Hochladen'   },
  ];
}
