/** The four ways the page can be dressed: two recipes, each in light and dark. No DOM in here. */
export interface Skin {
  id: string;
  recipe: 'studio' | 'editorial';
  theme: 'light' | 'dark';
  name: string;
  tone: string;
  text: string;
}

export const SKINS: readonly Skin[] = [
  { id: 'studio-light', recipe: 'studio', theme: 'light', name: 'Studio', tone: 'Light', text: 'Dense tools' },
  { id: 'studio-dark', recipe: 'studio', theme: 'dark', name: 'Studio', tone: 'Dark', text: 'Dense tools' },
  { id: 'editorial-light', recipe: 'editorial', theme: 'light', name: 'Editorial', tone: 'Light', text: 'Reading pages' },
  { id: 'editorial-dark', recipe: 'editorial', theme: 'dark', name: 'Editorial', tone: 'Dark', text: 'Reading pages' },
];

export const DEFAULT_SKIN = SKINS[0] as Skin;

/** Reads the skin from a query string. Anything missing or unknown is the default. */
export function readSkin(search: string): Skin {
  const id = new URLSearchParams(search).get('skin');
  return SKINS.find((skin) => skin.id === id) ?? DEFAULT_SKIN;
}

/** Writes the skin into a query string, keeping every other parameter, and leaves the default out. */
export function writeSkin(skin: Skin, search = ''): string {
  const params = new URLSearchParams(search);
  if (skin.id === DEFAULT_SKIN.id) params.delete('skin');
  else params.set('skin', skin.id);
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** What a visitor puts on their own page to get this skin. */
export const skinAttributes = (skin: Skin) => `<html data-q-recipe="${skin.recipe}" data-q-theme="${skin.theme}">`;

/** Whether a box covers a viewport closely enough that nothing behind it can be seen changing. */
export function covers(box: { left: number; top: number; right: number; bottom: number }, viewport: { width: number; height: number }, slack = 6): boolean {
  return box.left <= slack && box.top <= slack && box.right >= viewport.width - slack && box.bottom >= viewport.height - slack;
}
