import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { USAGE } from './usage';

describe('gallery usage examples', () => {
  for (const [name, code] of Object.entries(USAGE)) {
    it(`${name} parses and imports only a public entry`, () => {
      const wrapped = code.replace(/^(<[A-Z][\s\S]*>)$/m, '$1').replace(/\n\n(<[A-Z][\s\S]*)$/, '\n\nconst view = (\n$1\n);');
      expect(() => transformSync(wrapped, { loader: 'tsx' })).not.toThrow();
      expect(code).toMatch(new RegExp(`from '@qbeka/react/${name}'`));
      expect(code).toContain("import '@qbeka/react/styles.css';");
    });
  }
});
