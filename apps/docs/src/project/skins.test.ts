import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN, SKINS, covers, readSkin, skinAttributes, writeSkin } from './skins';

describe('page skins', () => {
  it('has four, and every one round trips through the address', () => {
    expect(SKINS).toHaveLength(4);
    for (const skin of SKINS) expect(readSkin(writeSkin(skin))).toBe(skin);
  });

  it('keeps the default out of the address, and falls back to it', () => {
    expect(writeSkin(DEFAULT_SKIN)).toBe('');
    expect(writeSkin(DEFAULT_SKIN, '?skin=editorial-dark&layout=row')).toBe('?layout=row');
    expect(readSkin('?skin=neon')).toBe(DEFAULT_SKIN);
    expect(readSkin('')).toBe(DEFAULT_SKIN);
  });

  it('keeps parameters that are not its own', () => {
    expect(writeSkin(SKINS[3] as (typeof SKINS)[number], '?layout=sheet')).toBe('?layout=sheet&skin=editorial-dark');
  });

  it('gives the attributes for a page', () => {
    expect(skinAttributes(SKINS[2] as (typeof SKINS)[number])).toBe('<html data-q-recipe="editorial" data-q-theme="light">');
  });

  it('knows when a plate hides the page', () => {
    const viewport = { width: 1000, height: 800 };
    expect(covers({ left: 0, top: 0, right: 1000, bottom: 800 }, viewport)).toBe(true);
    expect(covers({ left: 4, top: 5, right: 996, bottom: 795 }, viewport)).toBe(true);
    expect(covers({ left: 40, top: 0, right: 1000, bottom: 800 }, viewport)).toBe(false);
    expect(covers({ left: 0, top: 0, right: 1000, bottom: 700 }, viewport)).toBe(false);
  });
});
