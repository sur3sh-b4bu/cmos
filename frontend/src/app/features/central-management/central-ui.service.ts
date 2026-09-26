import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MasterLookupService } from '../../core/services/master-lookup.service';
import { NotificationService } from '../../core/services/notification.service';
import { extractErrorMessage } from '../../core/utils/http-error.util';
import { Context } from './central.models';

/** A row of a full ranking shown in the "view all" dialog. */
export interface RankingRow {
  id: number | string;
  label: string;
  display: string;
  changePct?: number | null;
  share?: number;
  churchId?: number;
}

export interface RankingRequest {
  title: string;
  rows: RankingRow[];
}

/**
 * What is open on top of the current Central Management screen: the church drawer, the compare dialog, the
 * full-ranking dialog, the full-insights dialog. Kept in one service so any screen can open them and the
 * layout renders each exactly once.
 */
@Injectable({ providedIn: 'root' })
export class CentralUiService {
  private router = inject(Router);
  private auth = inject(AuthService);
  private masterLookup = inject(MasterLookupService);
  private notification = inject(NotificationService);

  readonly drawerChurchId = signal<number | null>(null);
  readonly compareOpen = signal(false);
  readonly ranking = signal<RankingRequest | null>(null);
  readonly insightsOpen = signal(false);
  /** The period the visible screen is showing, for the header's "1 Sep – 25 Sep 2026" line. */
  readonly context = signal<Context | null>(null);

  openChurch(id: number): void {
    this.drawerChurchId.set(id);
  }
  closeChurch(): void {
    this.drawerChurchId.set(null);
  }
  openCompare(): void {
    this.compareOpen.set(true);
  }
  openRanking(request: RankingRequest): void {
    this.ranking.set(request);
  }
  closeAll(): void {
    this.drawerChurchId.set(null);
    this.compareOpen.set(false);
    this.ranking.set(null);
    this.insightsOpen.set(false);
  }

  /** Leaves Central Management and works inside one church (its normal operational screens). */
  async openChurchManagement(churchId: number): Promise<void> {
    try {
      const church = await firstValueFrom(this.masterLookup.getById<{ id: number; name: string; theme_color?: string | null; logo_url?: string | null }>('churches', churchId));
      this.auth.setActiveChurchBranch(church, null);
      this.closeAll();
      await this.router.navigate(['/dashboard']);
    } catch (err) {
      this.notification.error(extractErrorMessage(err));
    }
  }
}
