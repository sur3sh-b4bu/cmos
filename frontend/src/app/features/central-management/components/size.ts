import { DestroyRef, ElementRef, Signal, inject, signal } from '@angular/core';

export interface Size {
  w: number;
  h: number;
}

/**
 * The live size of a component's own element. Charts and lists use it to draw at their real pixel size and to
 * decide how many rows fit, which is how the Central Management screens stay inside the viewport without scrolling.
 * Call from a component's field initializer.
 */
export function observeSize(): Signal<Size> {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const destroyRef = inject(DestroyRef);
  const size = signal<Size>({ w: 0, h: 0 });
  if (typeof ResizeObserver === 'undefined') return size;
  const observer = new ResizeObserver((entries) => {
    const box = entries[0].contentRect;
    const next = { w: Math.floor(box.width), h: Math.floor(box.height) };
    const current = size();
    if (next.w !== current.w || next.h !== current.h) size.set(next);
  });
  observer.observe(el);
  destroyRef.onDestroy(() => observer.disconnect());
  return size;
}
