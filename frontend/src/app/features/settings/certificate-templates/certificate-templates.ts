import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  CertificateTemplateService,
  CertificateTemplate,
  CertificateType,
} from './certificate-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { extractErrorMessage } from '../../../core/utils/http-error.util';

interface FieldOption {
  value: string;
  label: string;
}

interface FieldMeta {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'select';
  options?: FieldOption[];
}

interface GroupMeta {
  title: string;
  description: string;
  icon: string;
  fields: FieldMeta[];
}

@Component({
  selector: 'coms-certificate-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './certificate-templates.html',
  styleUrl: './certificate-templates.scss',
})
export class CertificateTemplatesComponent implements OnInit {
  private templateService = inject(CertificateTemplateService);
  private notification = inject(NotificationService);
  private dialog = inject(MatDialog);

  loading = signal(true);
  saving = signal(false);
  previewing = signal(false);
  activeTab = signal<CertificateType>('baptism');

  templates = signal<Record<CertificateType, CertificateTemplate> | null>(null);

  currentTemplate = computed(() => {
    const map = this.templates();
    return map ? map[this.activeTab()] : null;
  });

  isCustomized = computed(() => !!this.currentTemplate()?.is_customized);

  readonly tabs: { type: CertificateType; label: string; icon: string }[] = [
    { type: 'baptism', label: 'Baptism Certificate', icon: 'water_drop' },
    { type: 'marriage', label: 'Marriage Certificate', icon: 'favorite' },
    { type: 'confirmation', label: 'Confirmation Certificate', icon: 'workspace_premium' },
    { type: 'death', label: 'Death Certificate', icon: 'sentiment_neutral' },
  ];

  readonly fieldGroups: Record<CertificateType, GroupMeta[]> = {
    baptism: [
      {
        title: 'Child & Sacrament Information',
        description: 'Labels for baptism register details and date records',
        icon: 'child_care',
        fields: [
          { key: 'child_name', label: "Child's Christian Name", placeholder: "Child's Christian Name" },
          { key: 'date_of_birth', label: 'Date of Birth', placeholder: 'Date of Birth' },
          { key: 'gender', label: 'Gender / Sex', placeholder: 'Sex' },
          { key: 'place_of_baptism', label: 'Place of Baptism', placeholder: 'Place of Baptism' },
          { key: 'date_of_baptism', label: 'Date of Baptism', placeholder: 'Date of Baptism' },
        ],
      },
      {
        title: 'Family & Godparents',
        description: 'Labels for parentage, residence, and sponsor names',
        icon: 'people',
        fields: [
          { key: 'parents_name', label: "Parent's Name", placeholder: "Parent's Name" },
          { key: 'parent_residence', label: "Parent's Residence", placeholder: "Parent's Residence" },
          { key: 'godparents', label: 'God Parents', placeholder: 'God Parents' },
        ],
      },
      {
        title: 'Clergy & Remarks',
        description: 'Labels for officiating priest, register notes, and date label',
        icon: 'menu_book',
        fields: [
          { key: 'priest', label: 'Priest who Baptised', placeholder: 'Priest who Baptised' },
          { key: 'remarks', label: 'Remarks', placeholder: 'Remarks' },
          { key: 'date_label', label: 'Date Label (Footer)', placeholder: 'Date :' },
        ],
      },
    ],
    marriage: [
      {
        title: 'Marriage Solemnization',
        description: 'Labels for wedding dates, church venue, and canonical dispensation',
        icon: 'church',
        fields: [
          { key: 'marriage_date', label: 'When Married', placeholder: 'When Married' },
          { key: 'where_married', label: 'Where Married', placeholder: 'Where Married' },
          { key: 'banns_or_licence', label: 'By Banns or Licence', placeholder: 'By banns or Licence' },
          { key: 'impediments_dispensed', label: 'Canonical Impediments Dispensed', placeholder: 'Can. impediments dispensed' },
        ],
      },
      {
        title: 'Parties: Bridegroom & Bride Details',
        description: 'Labels for couple names, ages, status, profession, and parentage',
        icon: 'diversity_1',
        fields: [
          { key: 'parties_name', label: 'Name of the Parties (Main)', placeholder: 'Name of the Parties' },
          { key: 'groom_sublabel', label: 'Bridegroom Sub-label', placeholder: 'Bridegroom' },
          { key: 'bride_sublabel', label: 'Bride Sub-label', placeholder: 'Bride' },
          { key: 'age', label: 'Age (Main)', placeholder: 'Age' },
          { key: 'groom_age_sublabel', label: "Bridegroom's Age Sub-label", placeholder: "Bridegroom's" },
          { key: 'bride_age_sublabel', label: "Bride's Age Sub-label", placeholder: "Bride's" },
          { key: 'condition', label: 'Condition', placeholder: 'Condition' },
          { key: 'profession', label: 'Profession', placeholder: 'Profession' },
          { key: 'residence', label: 'Residence at Marriage', placeholder: 'Residence at the time of Marriage' },
          { key: 'father_name', label: "Father's Name & Surname", placeholder: "Father's Name & Surname" },
        ],
      },
      {
        title: 'Witnesses Configuration',
        description: 'Main label, number of witness lines, and numbering prefix (1., 2.) for each witness',
        icon: 'groups',
        fields: [
          { key: 'witnesses', label: 'Witnesses Main Label', placeholder: 'Witnesses', hint: 'Header label on the left' },
          {
            key: 'witness_count',
            label: 'Witness Lines Count',
            type: 'select',
            placeholder: 'Auto (Match entered, min 2)',
            hint: 'Lines to print on certificate',
            options: [
              { value: 'auto', label: 'Auto (Match entered, min 2)' },
              { value: '2', label: '2 Witness Lines (Standard)' },
              { value: '3', label: '3 Witness Lines' },
              { value: '4', label: '4 Witness Lines (Expanded)' },
            ],
          },
          { key: 'witness1_prefix', label: 'Witness 1 Prefix', placeholder: '1.', hint: 'e.g. 1.' },
          { key: 'witness2_prefix', label: 'Witness 2 Prefix', placeholder: '2.', hint: 'e.g. 2.' },
          { key: 'witness3_prefix', label: 'Witness 3 Prefix', placeholder: '3.', hint: 'e.g. 3.' },
          { key: 'witness4_prefix', label: 'Witness 4 Prefix', placeholder: '4.', hint: 'e.g. 4.' },
        ],
      },
      {
        title: 'Clergy & Footer',
        description: 'Officiating minister of ceremony and date footer label',
        icon: 'assignment_ind',
        fields: [
          { key: 'minister', label: 'Minister of Ceremony', placeholder: 'Minister of the Ceremony', hint: 'Officiating minister label' },
          { key: 'date_label', label: 'Date Label (Footer)', placeholder: 'Date :', hint: 'Printed above bottom date' },
        ],
      },
    ],
    confirmation: [
      {
        title: 'Candidate Details',
        description: 'Labels for candidate identification, age, gender, and family',
        icon: 'person',
        fields: [
          { key: 'name', label: 'Candidate Name', placeholder: 'Name' },
          { key: 'age', label: 'Age', placeholder: 'Age' },
          { key: 'gender', label: 'Sex / Gender', placeholder: 'Sex' },
          { key: 'parents', label: 'Parents', placeholder: 'Parents' },
          { key: 'caste', label: 'Caste / Community', placeholder: 'Caste' },
        ],
      },
      {
        title: 'Parish, Domicile & Sponsors',
        description: 'Labels for domicile, sponsors, confirmation venue and date',
        icon: 'location_city',
        fields: [
          { key: 'sponsors', label: 'Sponsors', placeholder: 'Sponsors' },
          { key: 'domicile', label: 'Domicile', placeholder: 'Domicile' },
          { key: 'place_of_confirmation', label: 'Place of Confirmation', placeholder: 'Place of Confirmation' },
          { key: 'date_of_confirmation', label: 'Date of Confirmation', placeholder: 'Date of Confirmation' },
          { key: 'bishop', label: 'Bishop who confirmed', placeholder: 'Bishop who confirmed' },
          { key: 'date_label', label: 'Date Label (Footer)', placeholder: 'Date :' },
        ],
      },
    ],
    death: [
      {
        title: 'Deceased Person Details',
        description: 'Labels for deceased identification, age, parents, and profession',
        icon: 'badge',
        fields: [
          { key: 'deceased_name', label: 'Deceased Name', placeholder: 'Name' },
          { key: 'age', label: 'Age', placeholder: 'Age' },
          { key: 'place', label: 'Place', placeholder: 'Place' },
          { key: 'profession', label: 'Profession', placeholder: 'Profession' },
          { key: 'parents', label: 'Parents', placeholder: 'Parents' },
        ],
      },
      {
        title: 'Death & Holy Sacraments',
        description: 'Labels for passing date, location, cause, and last sacraments',
        icon: 'medical_services',
        fields: [
          { key: 'date_of_death', label: 'Date of Death', placeholder: 'Date of death' },
          { key: 'place_of_death', label: 'Place of Death', placeholder: 'Place of death' },
          { key: 'cause', label: 'Cause of Death', placeholder: 'Cause' },
          { key: 'confession', label: 'Confession (C.Confession)', placeholder: 'C.Confession' },
          { key: 'viaticum', label: 'Viaticum (V.Viaticum)', placeholder: 'V.Viaticum' },
          { key: 'anointing', label: 'Anointing (A.Anointing)', placeholder: 'A.Anointing' },
        ],
      },
      {
        title: 'Burial & Clergy',
        description: 'Labels for interment, cemetery, officiating priest, and footer',
        icon: 'place',
        fields: [
          { key: 'burial_date', label: 'Date of Burial', placeholder: 'Date of Burial' },
          { key: 'cemetery', label: 'Place of Burial / Cemetery', placeholder: 'Place of Burial' },
          { key: 'minister', label: 'Officiating Minister', placeholder: 'Minister' },
          { key: 'place_label', label: 'Place Label (Footer)', placeholder: 'Place :' },
          { key: 'date_label', label: 'Date Label (Footer)', placeholder: 'Date  :' },
        ],
      },
    ],
  };

  async ngOnInit(): Promise<void> {
    await this.loadTemplates();
  }

  async loadTemplates(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.templateService.getAll());
      this.templates.set(res.data);
    } catch (err) {
      this.notification.error(extractErrorMessage(err, 'Failed to load certificate templates'));
    } finally {
      this.loading.set(false);
    }
  }

  onTabChange(index: number): void {
    const tab = this.tabs[index];
    if (tab) {
      this.activeTab.set(tab.type);
    }
  }

  updateHeaderProperty(prop: 'title' | 'subheader_prefix' | 'diocese_label' | 'signatory_title' | 'seal_label', value: string): void {
    const all = this.templates();
    if (!all) return;
    const type = this.activeTab();
    const cur = all[type];
    this.templates.set({
      ...all,
      [type]: {
        ...cur,
        [prop]: value,
      },
    });
  }

  updateFieldLabel(key: string, value: string): void {
    const all = this.templates();
    if (!all) return;
    const type = this.activeTab();
    const cur = all[type];
    this.templates.set({
      ...all,
      [type]: {
        ...cur,
        field_labels: {
          ...cur.field_labels,
          [key]: value,
        },
      },
    });
  }

  getFieldLabel(key: string): string {
    const cur = this.currentTemplate();
    const val = cur?.field_labels?.[key];
    if (val !== undefined && val !== null && val !== '') return val;
    if (key === 'witness_count') return '2';
    if (key === 'witness1_prefix') return '1.';
    if (key === 'witness2_prefix') return '2.';
    if (key === 'witness3_prefix') return '3.';
    if (key === 'witness4_prefix') return '4.';
    return '';
  }

  async saveTemplate(): Promise<void> {
    const cur = this.currentTemplate();
    if (!cur) return;
    const type = this.activeTab();
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.templateService.update(type, {
          title: cur.title,
          subheader_prefix: cur.subheader_prefix,
          diocese_label: cur.diocese_label,
          signatory_title: cur.signatory_title,
          seal_label: cur.seal_label,
          field_labels: cur.field_labels,
        })
      );
      const all = this.templates();
      if (all) {
        this.templates.set({
          ...all,
          [type]: res.data,
        });
      }
      this.notification.success(`${this.getTabLabel(type)} template saved successfully`);
    } catch (err) {
      this.notification.error(extractErrorMessage(err, 'Failed to save certificate template'));
    } finally {
      this.saving.set(false);
    }
  }

  confirmReset(): void {
    const type = this.activeTab();
    const typeName = this.getTabLabel(type);
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Reset ${typeName} to Defaults?`,
        message: `This will remove all custom labels, title, and signatory text for ${typeName} and restore official diocese standard text.`,
        confirmLabel: 'Reset to Default',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      this.saving.set(true);
      try {
        const res = await firstValueFrom(this.templateService.reset(type));
        const all = this.templates();
        if (all) {
          this.templates.set({
            ...all,
            [type]: res.data,
          });
        }
        this.notification.success(`${typeName} template reset to default text`);
      } catch (err) {
        this.notification.error(extractErrorMessage(err, 'Failed to reset certificate template'));
      } finally {
        this.saving.set(false);
      }
    });
  }

  async previewPdf(): Promise<void> {
    const type = this.activeTab();
    this.previewing.set(true);
    try {
      const blob = await firstValueFrom(this.templateService.getPreviewPdf(type));
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      this.notification.error(extractErrorMessage(err, 'Failed to preview certificate PDF'));
    } finally {
      this.previewing.set(false);
    }
  }

  getTabLabel(type: CertificateType): string {
    return this.tabs.find((t) => t.type === type)?.label ?? type;
  }
}
