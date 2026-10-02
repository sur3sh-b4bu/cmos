import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/**
 * PDF/export endpoints need the session cookie plus the church/branch
 * headers the auth interceptor adds -- a plain <a href> or window.open()
 * can't send those headers. Fetching as a blob through HttpClient (so the
 * interceptor applies) and opening/downloading the object URL is the
 * standard workaround for authenticated file downloads in an SPA.
 */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private http = inject(HttpClient);

  /**
   * Loads the PDF into a hidden iframe and calls the browser's native print
   * dialog directly, instead of just opening the file in a new tab and
   * leaving the user to find the print button themselves -- this is what
   * office staff actually want from a "Print" button.
   *
   * The iframe's own `load` event fires once the PDF's bytes have arrived,
   * but rendering a PDF (unlike plain HTML) means spinning up the browser's
   * separate PDF-viewer plugin inside that iframe, which can still be
   * initializing for a bit after `load` -- calling `print()` before it's
   * actually ready has been observed to silently do nothing (no dialog, no
   * thrown error, nothing to catch) rather than fail loudly, which is why
   * this waits for two animation frames (past the current paint) plus a
   * longer settle delay, then RETRIES the print call once more a second
   * later as a safety net, rather than trusting a single fixed timeout to
   * always be enough on every machine. Certificates/Daily Register still go
   * through this path; single Mass Intention/Contribution receipts moved to
   * printHtml() below instead (plain HTML has no such plugin-init delay).
   */
  async printPdf(url: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const objectUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = objectUrl;

    const cleanup = () => {
      iframe.remove();
      URL.revokeObjectURL(objectUrl);
    };

    const tryPrint = (): boolean => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        return true;
      } catch {
        // Some browsers block scripted access to a PDF-rendering iframe;
        // fall back to opening it in a new tab so the user can print from there.
        window.open(objectUrl, '_blank');
        return false;
      }
    };

    iframe.onload = () => {
      // Double rAF: wait until the browser has actually painted the current
      // frame (the iframe just being "loaded" doesn't mean the PDF plugin
      // inside it has finished its own first render pass yet).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setTimeout(() => {
            const openedFallbackTab = !tryPrint();
            // A second, later attempt costs nothing if the first one
            // already opened the print dialog (the user is looking at that
            // dialog, so this second print() is a no-op) or already fell
            // back to a new tab -- it only helps the case a slow-to-init
            // PDF viewer silently swallowed the first call.
            if (!openedFallbackTab) setTimeout(tryPrint, 1000);
          }, 500);
        })
      );
    };

    document.body.appendChild(iframe);
    // Printing is synchronous/blocking in most browsers, so it's safe to
    // clean up once the print dialog would have closed; if the browser
    // fell back to a new tab instead, the object URL simply outlives this
    // grace window (extended past the retry above).
    setTimeout(cleanup, 65_000);
  }

  /**
   * Same idea as printPdf, for a server-rendered HTML print view (currently
   * the single Mass Intention/Contribution receipts -- see backend's
   * receiptHtml.js for why an HTML page, not a PDF, is what makes the
   * browser's print dialog default to the right paper size). Loaded via
   * `srcdoc` rather than a Blob URL so the page's own relative asset paths
   * (its @font-face's /fonts/... ) resolve against this app's own origin,
   * exactly where those files already live.
   */
  async printHtml(url: string): Promise<void> {
    const html = await firstValueFrom(this.http.get(url, { responseType: 'text' }));

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    const cleanup = () => iframe.remove();

    const openFallbackTab = () => {
      // Some browsers block scripted access to an iframe about to print;
      // fall back to opening the same HTML in a new tab so the user can
      // print it from there.
      const blob = new Blob([html], { type: 'text/html' });
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    };

    iframe.onload = () => {
      // Wait for the page's own @font-face (Tamil-capable, used for every
      // receipt regardless of language -- see receiptHtml.js) to finish
      // loading before printing, so a Tamil name/intention never briefly
      // shows as fallback tofu boxes in the print preview.
      const fontsReady = iframe.contentDocument?.fonts?.ready ?? Promise.resolve();
      fontsReady.finally(() => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            openFallbackTab();
          }
        }, 100);
      });
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    setTimeout(cleanup, 60_000);
  }

  printHtmlContent(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    const cleanup = () => iframe.remove();

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          const blob = new Blob([html], { type: 'text/html' });
          const objectUrl = URL.createObjectURL(blob);
          window.open(objectUrl, '_blank');
          setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
        }
      }, 150);
    };

    iframe.srcdoc = html;
    document.body.appendChild(iframe);
    setTimeout(cleanup, 60_000);
  }

  async download(url: string, filename: string): Promise<void> {
    const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  }
}
