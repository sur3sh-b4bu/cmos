import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar';
import { HeaderComponent } from './header';

@Component({
  selector: 'coms-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class ShellComponent {
  collapsed = signal(localStorage.getItem('coms-sidebar-collapsed') === 'true');

  onCollapsedChange(value: boolean): void {
    this.collapsed.set(value);
    localStorage.setItem('coms-sidebar-collapsed', String(value));
  }
}
