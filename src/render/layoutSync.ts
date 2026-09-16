/** cap `el`'s height to `reference`'s rendered height, measured from `el`'s
 *  own top within its panel (so a head/search box/etc. above it is
 *  respected) - keeps two side-by-side (or stacked, on narrow viewports)
 *  panels visually level instead of one running far past the other, with
 *  `el` scrolling internally for the rest. CSS Grid's own
 *  align-items:stretch can't do this on its own: an auto-sized row's
 *  height is derived from each item's own content, so a flex/overflow
 *  trick on `el` alone doesn't shrink it - only measuring the reference
 *  panel's finished layout does. */
export function capHeightToMatch(el: HTMLElement | null, reference: HTMLElement | null): void {
  if (!el || !reference) return;
  const panel = el.closest(".panel") as HTMLElement | null;
  if (!panel) return;
  const elTopWithinPanel = el.getBoundingClientRect().top - panel.getBoundingClientRect().top;
  const maxHeight = Math.max(160, reference.getBoundingClientRect().height - elTopWithinPanel - 8);
  el.style.maxHeight = `${maxHeight}px`;
}
