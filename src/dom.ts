/** typed shorthand for document.getElementById - throws early if an id is wrong
 *  rather than failing later with a confusing "cannot read property of null".
 *  T defaults to HTMLElement but accepts any Element (e.g. SVG elements) too. */
export function $<T extends Element = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found in the DOM`);
  return el as unknown as T;
}
