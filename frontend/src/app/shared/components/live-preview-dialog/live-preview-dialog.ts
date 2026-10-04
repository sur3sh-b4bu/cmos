import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { CertificateType } from '../../../features/certificates/certificate.service';
import { CertificateTemplate } from '../../../features/settings/certificate-templates/certificate-template.service';
import { CertificateLivePreviewComponent } from '../certificate-live-preview/certificate-live-preview';
import { ReceiptLivePreviewComponent } from '../receipt-live-preview/receipt-live-preview';

export interface LivePreviewDialogData {
  title: string;
  previewType: 'certificate' | 'receipt';
  certType?: CertificateType;
  receiptType?: 'mass-intention' | 'bulk-mass-intention' | 'contribution';
  formGroup?: FormGroup;
  initialData?: any;
  church?: any;
  template?: CertificateTemplate | null;
  certificateNo?: string | null;
  receiptNo?: string | null;
  bulkRows?: any[];
}

@Component({
  selector: 'coms-live-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CertificateLivePreviewComponent,
    ReceiptLivePreviewComponent,
  ],
  templateUrl: './live-preview-dialog.html',
  styleUrl: './live-preview-dialog.scss',
})
export class LivePreviewDialogComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('contentEl') contentEl?: ElementRef<HTMLElement>;
  @ViewChild(CertificateLivePreviewComponent) certPreview?: CertificateLivePreviewComponent;
  @ViewChild(ReceiptLivePreviewComponent) receiptPreview?: ReceiptLivePreviewComponent;

  dialogRef = inject(MatDialogRef<LivePreviewDialogComponent>);

  liveData = signal<any>({});
  zoom = signal<number>(1);
  private formSub?: Subscription;

  constructor(@Inject(MAT_DIALOG_DATA) public data: LivePreviewDialogData) {}

  ngOnInit(): void {
    if (this.data.formGroup) {
      this.liveData.set(this.data.formGroup.getRawValue());
      this.formSub = this.data.formGroup.valueChanges.subscribe(() => {
        this.liveData.set(this.data.formGroup!.getRawValue());
      });
    } else if (this.data.initialData) {
      this.liveData.set(this.data.initialData);
    }
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.contentEl?.nativeElement) {
        this.contentEl.nativeElement.scrollTop = 0;
      }
    }, 50);
  }

  ngOnDestroy(): void {
    this.formSub?.unsubscribe();
  }

  zoomIn(): void {
    this.zoom.update((z) => Math.min(1.4, Math.round((z + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.zoom.update((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10));
  }

  resetZoom(): void {
    this.zoom.set(1);
  }

  print(): void {
    if (this.data.previewType === 'certificate') {
      this.certPreview?.print();
    } else {
      this.receiptPreview?.print();
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
