import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../core/services/auth.service';
import { NAV_ITEMS } from '../core/models/nav-item.model';

@Component({
  selector: 'coms-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  private authService = inject(AuthService);

  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();

  readonly navItems = NAV_ITEMS.filter(
    (item) => !item.permissions?.length || this.authService.hasAnyPermission(item.permissions)
  );

  toggleCollapsed(): void {
    this.collapsedChange.emit(!this.collapsed);
  }
}
