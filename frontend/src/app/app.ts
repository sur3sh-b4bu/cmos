import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'coms-root',
  imports: [RouterOutlet, MatProgressSpinnerModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  // Injecting ThemeService here forces its constructor to run before first
  // paint, so the correct data-theme attribute is set without a flash.
  private themeService = inject(ThemeService);
  authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.restoreSession();
  }
}
