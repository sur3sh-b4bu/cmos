import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CertificateType } from '../../../features/certificates/certificate.service';
import { CertificateTemplate, CertificateTemplateService } from '../../../features/settings/certificate-templates/certificate-template.service';
import { MasterLookupService } from '../../../core/services/master-lookup.service';
import { AuthService } from '../../../core/services/auth.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { LanguageService } from '../../../core/services/language.service';
import { firstValueFrom } from 'rxjs';

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

@Component({
  selector: 'coms-certificate-live-preview',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './certificate-live-preview.html',
  styleUrl: './certificate-live-preview.scss',
})
export class CertificateLivePreviewComponent implements OnInit {
  @Input({ required: true }) certType!: CertificateType;
  @Input({ required: true }) data: any = {};
  @Input() certificateNo: string | null = null;
  @Input() template: CertificateTemplate | null = null;
  @Input() church: any = null;
  @Input() showPrintButton = true;
  @Input() zoom = 1;

  private masterLookup = inject(MasterLookupService);
  private authService = inject(AuthService);
  private templateService = inject(CertificateTemplateService);
  private fileDownload = inject(FileDownloadService);
  languageService = inject(LanguageService);

  priests = signal<{ id: number; name: string; display_name?: string }[]>([]);
  genders = signal<{ id: number; name: string }[]>([]);
  loadedTemplate = signal<CertificateTemplate | null>(null);

  ngOnInit(): void {
    this.masterLookup.list<{ id: number; name: string; display_name?: string }>('priests').subscribe((p) => this.priests.set(p));
    this.masterLookup.list<{ id: number; name: string }>('genders').subscribe((g) => this.genders.set(g));

    if (!this.template) {
      this.templateService.getByType(this.certType).subscribe({
        next: (res) => this.loadedTemplate.set(res.data),
        error: () => {},
      });
    }
  }

  get effectiveTemplate(): CertificateTemplate | null {
    return this.template || this.loadedTemplate();
  }

  get effectiveChurch(): any {
    if (this.church) return this.church;
    const user = this.authService.currentUser();
    const active = this.authService.activeChurchBranch();
    return {
      name: active?.churchName || user?.churchName || "St. Mary's Church",
      city: 'Tuticorin',
      diocese: 'Tuticorin Diocese',
      theme_color: active?.themeColor || user?.churchThemeColor || 'maroon',
    };
  }

  get churchLocation(): string {
    const c = this.effectiveChurch;
    return [c?.name, c?.city].filter(Boolean).join(', ');
  }

  get themeColor(): string {
    const raw = this.authService.effectiveChurchThemeColor() || this.effectiveChurch?.theme_color || 'maroon';
    return PRIMARY_BY_THEME[raw] || (raw.startsWith('#') ? raw : '#5c0d1e');
  }

  get effectiveCertificateNo(): string {
    return this.certificateNo || 'PREVIEW-CERT';
  }

  lbl(key: string, def: string): string {
    const labels = this.effectiveTemplate?.field_labels || {};
    const val = labels[key];
    return val !== undefined && val !== null && String(val).trim() !== '' ? val : def;
  }

  splitIntoLines(valText: any): string[] {
    if (valText === null || valText === undefined) return [''];
    const raw = String(valText).trim();
    if (!raw) return [''];
    if (raw.includes('\n')) {
      const parts = raw.split('\n').map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts : [''];
    }
    if (/&|\s+\b(?:and)\b\s+/i.test(raw)) {
      const parts = raw.split(/\s*&\s*|\s+\b(?:and)\b\s+/i).map((s) => s.trim()).filter(Boolean);
      if (parts.length > 1) return parts;
    }
    return [raw];
  }

  get parentLines(): string[] {
    if (this.data?.parents) {
      return this.splitIntoLines(this.data.parents);
    }
    const parts = [this.data?.father_name, this.data?.mother_name].filter(Boolean);
    return parts.length > 0 ? parts : [''];
  }

  get deceasedNameLines(): string[] {
    return this.splitIntoLines(this.data?.deceased_name);
  }

  get title(): string {
    if (this.effectiveTemplate?.title) return this.effectiveTemplate.title;
    switch (this.certType) {
      case 'baptism':
        return 'EXTRACT FROM THE REGISTER OF BAPTISM';
      case 'marriage':
        return 'EXTRACT FROM THE REGISTER OF INDIAN CHRISTIAN MARRIAGES';
      case 'death':
        return 'EXTRACT FROM THE REGISTER OF\nDEATHS KEPT';
      case 'confirmation':
        return 'Extract from Confirmation Register';
    }
  }

  get titleLines(): string[] {
    const t = this.title;
    return t.includes('\n') ? t.split('\n') : [t];
  }

  get subheaderPrefix(): string {
    if (this.effectiveTemplate?.subheader_prefix) return this.effectiveTemplate.subheader_prefix;
    switch (this.certType) {
      case 'baptism':
      case 'confirmation':
        return 'Kept at';
      case 'marriage':
        return 'Solemnized at';
      case 'death':
        return 'at';
    }
  }

  get dioceseText(): string {
    if (this.effectiveTemplate?.diocese_label) return this.effectiveTemplate.diocese_label;
    const d = this.effectiveChurch?.diocese;
    if (d && String(d).trim()) {
      return d.toLowerCase().includes('diocese') ? d : `${d} Diocese`;
    }
    return 'Tuticorin Diocese';
  }

  get signatoryTitle(): string {
    if (this.effectiveTemplate?.signatory_title) return this.effectiveTemplate.signatory_title;
    switch (this.certType) {
      case 'baptism':
        return 'Catholic Priest';
      case 'marriage':
      case 'confirmation':
        return 'Parish Priest';
      case 'death':
        return 'CATHOLIC PRIEST';
    }
  }

  get sealText(): string {
    return this.effectiveTemplate?.seal_label || (this.certType === 'marriage' ? 'Seal' : 'SEAL');
  }

  get priestName(): string {
    if (this.data?.custom_priest_name) return this.data.custom_priest_name;
    if (this.data?.priest_display_name) return this.data.priest_display_name;
    const id = this.data?.priest_id;
    if (id) {
      const found = this.priests().find((p) => p.id === id);
      return found?.display_name || found?.name || '';
    }
    return '';
  }

  get genderName(): string {
    if (this.data?.gender_name) return this.data.gender_name;
    const id = this.data?.gender_id;
    if (id) {
      const found = this.genders().find((g) => g.id === id);
      return found?.name || '';
    }
    return '';
  }

  get placeOfBaptism(): string {
    return this.data?.place_of_baptism || this.effectiveChurch?.name || '';
  }

  get placeOfConfirmation(): string {
    return this.data?.place_of_confirmation || this.effectiveChurch?.name || '';
  }

  get whereMarried(): string {
    return this.data?.where_married || this.effectiveChurch?.name || '';
  }

  get godparentsText(): string {
    const list = [this.data?.godfather_name, this.data?.godmother_name].filter(Boolean);
    return list.join(', ');
  }

  get todayFormatted(): string {
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

  get witnessList(): { num: number; prefix: string; name: string }[] {
    const rawFields = [this.data?.witness1_name, this.data?.witness2_name, this.data?.witness3_name, this.data?.witness4_name];
    const names: string[] = [];
    for (const f of rawFields) {
      if (f && String(f).trim()) {
        const parts = String(f).split(/\n/).map((s) => s.trim()).filter(Boolean);
        names.push(...parts);
      }
    }

    const prefixes = [
      this.lbl('witness1_prefix', '1.'),
      this.lbl('witness2_prefix', '2.'),
      this.lbl('witness3_prefix', '3.'),
      this.lbl('witness4_prefix', '4.'),
    ];

    const countSetting = (this.effectiveTemplate?.field_labels?.['witness_count'] || 'auto').toString().trim().toLowerCase();
    let target = 2;
    if (countSetting === '4') target = 4;
    else if (countSetting === '3') target = 3;
    else if (countSetting === '2') target = 2;
    else {
      target = names.length >= 4 ? 4 : names.length === 3 ? 3 : 2;
    }

    const res = [];
    for (let i = 0; i < target; i++) {
      res.push({
        num: i + 1,
        prefix: prefixes[i] || `${i + 1}.`,
        name: names[i] || '',
      });
    }
    return res;
  }

  print(): void {
    const container = document.getElementById('coms-cert-preview-print-area');
    if (!container) return;
    const styles = `
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cert-preview-doc { box-shadow: none !important; border: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
        }
      </style>
    `;
    this.fileDownload.printHtmlContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Certificate Preview - ${this.effectiveCertificateNo}</title>
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
