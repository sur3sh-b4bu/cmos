import { Component, input } from '@angular/core';

/**
 * The frame every analytics block sits in: a compact titled card whose body takes whatever height is left, so
 * charts and lists inside it can size themselves to fit. Put controls for the panel in `[panelActions]`.
 */
@Component({
  selector: 'coms-central-panel',
  standalone: true,
  template: `
    <section class="panel">
      <header class="panel__head">
        <h3 class="panel__title">{{ title() }}</h3>
        @if (hint()) {
          <span class="panel__hint">{{ hint() }}</span>
        }
        <span class="panel__actions"><ng-content select="[panelActions]" /></span>
      </header>
      <div class="panel__body"><ng-content /></div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
        min-height: 0;
      }
      .panel {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--coms-surface);
        border: 1px solid var(--coms-border);
        border-radius: 10px;
        box-shadow: var(--coms-shadow-sm);
        padding: 10px 12px 10px;
        min-height: 0;
      }
      .panel__head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 6px;
        min-height: 18px;
      }
      /* The title keeps its width; the hint takes only what is left, so a long title in Tamil is never cut for a hint. */
      .panel__title {
        flex: 0 1 auto;
        min-width: 0;
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: var(--coms-text);
        letter-spacing: 0.005em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .panel__hint {
        flex: 1 1 0;
        font-size: 11px;
        color: var(--coms-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
      .panel__actions {
        margin-left: auto;
        display: inline-flex;
        gap: 6px;
        align-items: center;
        flex: none;
      }
      .panel__body {
        flex: 1;
        min-height: 0;
        position: relative;
      }
    `,
  ],
})
export class CentralPanelComponent {
  title = input.required<string>();
  hint = input<string>('');
}
