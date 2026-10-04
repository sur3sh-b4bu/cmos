import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/services/auth.service';
import { CurrencyService } from '../../../core/services/currency.service';
import { LanguageService } from '../../../core/services/language.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { localizedName } from '../../../core/utils/localized-name.util';

@Component({
  selector: 'coms-receipt-live-preview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './receipt-live-preview.html',
  styleUrl: './receipt-live-preview.scss',
})
export class ReceiptLivePreviewComponent implements OnInit {
  @Input({ required: true }) receiptType: 'mass-intention' | 'bulk-mass-intention' | 'contribution' = 'mass-intention';
  @Input({ required: true }) data: any = {};
  @Input() receiptNo: string | null = null;
  @Input() bulkRows: any[] = [];
  @Input() church: any = null;
  @Input() showPrintButton = true;
  @Input() zoom = 1;

  private authService = inject(AuthService);
  currencyService = inject(CurrencyService);
  languageService = inject(LanguageService);
  private masterLookup = inject(MasterLookupService);
  private fileDownload = inject(FileDownloadService);

  masses = signal<{ id: number; name: string; name_ta?: string | null; mass_time: string; offering_description?: string }[]>([]);
  intentions = signal<{ id: number; name: string; name_ta?: string | null; is_custom: number }[]>([]);
  contributionTypes = signal<{ id: number; name: string; name_ta?: string | null; code: string }[]>([]);
  paymentMethods = signal<{ id: number; name: string; code: string }[]>([]);

  ngOnInit(): void {
    this.currencyService.load();
    this.masterLookup.list<any>('masses').subscribe((m) => this.masses.set(m));
    this.masterLookup.list<any>('prayer_intention_master').subscribe((i) => this.intentions.set(i));
    this.masterLookup.list<any>('contribution_types').subscribe((c) => this.contributionTypes.set(c));
    this.masterLookup.list<any>('payment_methods').subscribe((p) => this.paymentMethods.set(p));
  }

  get effectiveChurch(): any {
    if (this.church) return this.church;
    const user = this.authService.currentUser();
    const active = this.authService.activeChurchBranch();
    return {
      name: active?.churchName || user?.churchName || 'Holy Cross Church',
      name_ta: user?.churchNameTa || null,
      address: 'Main Road, Tuticorin - 628001',
      phone: '+91 98765 43210',
      email: 'office@tuticorindiocese.org',
      website: 'www.tuticorindiocese.org',
      logo_url: active?.logoUrl || user?.churchLogoUrl || null,
      theme_color: active?.themeColor || user?.churchThemeColor || 'blue',
    };
  }

  get themeColor(): string {
    const raw = this.authService.effectiveChurchThemeColor() || this.effectiveChurch?.theme_color || 'maroon';
    const PRIMARY_BY_THEME: Record<string, string> = {
      blue: '#072a63',
      green: '#0b4d2c',
      red: '#7a1620',
      violet: '#3a2472',
      orange: '#8a3d12',
      purple: '#5c1a6b',
      pink: '#7a1450',
      teal: '#0c504b',
      maroon: '#5c0d1e',
      slate: '#24303f',
      amber: '#784c08',
      cyan: '#0b4f6c',
      olive: '#334d1b',
      bronze: '#4d2e14',
      plum: '#48164b',
    };
    return PRIMARY_BY_THEME[raw] || (raw.startsWith('#') ? raw : '#5c0d1e');
  }

  get churchDisplayName(): string {
    const lang = this.languageService.current();
    return (lang === 'ta' && this.effectiveChurch?.name_ta) ? this.effectiveChurch.name_ta : (this.effectiveChurch?.name || 'Church Office');
  }

  get billedBy(): string {
    const user = this.authService.currentUser();
    return user?.fullName || user?.username || 'Office Staff';
  }

  get effectiveReceiptNo(): string {
    return this.receiptNo || (this.data?.receipt_no || this.data?.receiptNo) || 'PREVIEW-001';
  }

  get selectedMass(): any {
    const massId = this.data?.massId || this.data?.mass_id;
    return this.masses().find((m) => m.id === massId);
  }

  get massDisplayName(): string {
    const mass = this.selectedMass;
    if (!mass) return this.data?.mass_name || '-';
    const name = localizedName(mass, this.languageService.current());
    return mass.mass_time ? `${name} (${this.formatTime(mass.mass_time)})` : name;
  }

  get massOfferingDescription(): string | null {
    return this.selectedMass?.offering_description || null;
  }

  get intentionDisplayName(): string {
    const intentionId = this.data?.prayerIntentionMasterId || this.data?.prayer_intention_master_id;
    const opt = this.intentions().find((i) => i.id === intentionId);
    const custom = (this.data?.customIntention || this.data?.custom_intention || '').trim();

    if (opt && !opt.is_custom) {
      const base = localizedName(opt, this.languageService.current());
      return custom ? `${base} - ${custom}` : base;
    }
    return custom || this.data?.custom_intention || '-';
  }

  get contributionTypeDisplayName(): string {
    const typeId = this.data?.contributionTypeId || this.data?.contribution_type_id;
    const opt = this.contributionTypes().find((t) => t.id === typeId);
    const custom = (this.data?.customContributionType || this.data?.custom_contribution_type || '').trim();

    if (opt && opt.code !== 'OTHERS') {
      const base = localizedName(opt, this.languageService.current());
      return base;
    }
    return custom || this.data?.custom_contribution_type || '-';
  }

  get paymentMethodName(): string {
    const methodId = this.data?.paymentMethodId || this.data?.payment_method_id;
    const opt = this.paymentMethods().find((p) => p.id === methodId);
    return opt?.name || 'Cash';
  }

  get formattedAmount(): string {
    const amt = Number(this.data?.offeringAmount ?? this.data?.offering_amount ?? this.data?.contributionAmount ?? this.data?.contribution_amount ?? 0);
    return `${this.currencyService.current().symbol} ${amt.toFixed(2)}`;
  }

  get totalBulkAmount(): string {
    const total = (this.bulkRows || []).reduce((acc, row) => acc + Number(row.offeringAmount || row.offering_amount || 0), 0);
    return `${this.currencyService.current().symbol} ${total.toFixed(2)}`;
  }

  get billedDateFormatted(): string {
    return this.formatDate(new Date());
  }

  formatDate(val: any): string {
    if (!val) return '';
    const d = val instanceof Date ? val : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  }

  formatTime(time: string): string {
    if (!time) return '';
    const parts = time.split(':');
    const hour = Number(parts[0]);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${parts[1] || '00'} ${suffix}`;
  }

  print(): void {
    const container = document.getElementById('coms-receipt-preview-print-area');
    if (!container) return;
    const styles = `
      <style>
        @page { size: 148mm 210mm; margin: 3.5mm 4mm; }
        @media print {
          body { margin: 0; padding: 3.5mm 4mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .receipt-preview-card { box-shadow: none !important; width: 100% !important; margin: 0 !important; }
        }
      </style>
    `;
    this.fileDownload.printHtmlContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt Preview - ${this.effectiveReceiptNo}</title>
        <link rel="stylesheet" href="/fonts/fonts.css">
        ${styles}
      </head>
      <body>
        ${container.outerHTML}
      </body>
      </html>
    `);
  }
}
