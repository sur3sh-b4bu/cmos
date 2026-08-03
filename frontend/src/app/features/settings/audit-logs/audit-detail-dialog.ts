import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { AuditLog } from './audit-log.model';

@Component({
  selector: 'coms-audit-detail-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Audit Log Detail</h2>
    <mat-dialog-content class="audit-detail">
      <dl>
        <dt>When</dt>
        <dd>{{ data.created_at }}</dd>
        <dt>User</dt>
        <dd>{{ data.username_snapshot || 'System' }}</dd>
        <dt>Action</dt>
        <dd>{{ data.action }}</dd>
        <dt>Module</dt>
        <dd>{{ data.module }}</dd>
        <dt>Entity</dt>
        <dd>{{ data.entity_type }} @if (data.entity_id) { (#{{ data.entity_id }}) }</dd>
        <dt>IP Address</dt>
        <dd>{{ data.ip_address || '-' }}</dd>
      </dl>

      @if (data.old_values) {
        <h3>Before</h3>
        <pre>{{ formatJson(data.old_values) }}</pre>
      }
      @if (data.new_values) {
        <h3>After</h3>
        <pre>{{ formatJson(data.new_values) }}</pre>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .audit-detail {
        max-width: 520px;
        dl {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 6px 12px;
          margin: 0 0 12px;
          font-size: 13px;
        }
        dt {
          color: var(--coms-text-muted);
        }
        dd {
          margin: 0;
        }
        h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: var(--coms-text-muted);
          margin: 12px 0 4px;
        }
        pre {
          background: var(--coms-surface-alt);
          border-radius: var(--coms-radius-sm);
          padding: 10px;
          font-size: 12px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }
      }
    `,
  ],
})
export class AuditDetailDialogComponent {
  data = inject<AuditLog>(MAT_DIALOG_DATA);

  formatJson(raw: string): string {
    try {
      return JSON.stringify(typeof raw === 'string' ? JSON.parse(raw) : raw, null, 2);
    } catch {
      return String(raw);
    }
  }
}
