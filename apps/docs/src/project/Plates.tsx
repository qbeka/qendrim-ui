import { Surface } from '@qbeka/react/surface';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SKINS, covers, type Skin } from './skins';

interface PlatesProps {
  skin: Skin;
  /** Changes the page. It calls `done` once the whole page has changed, which is when the plate may go home. */
  onSkin: (skin: Skin, done?: () => void) => void;
}

/** How long a plate rests over the page before it goes back, so the change is seen and not flashed. */
const REST_MS = 90;

/**
 * Four plates, one for each recipe and theme. Each is one Surface with two layouts: its place
 * in the row, and the whole viewport. Choosing a plate sends it to the viewport. Once it hides
 * the page, the page takes its tokens, and the plate goes home. It is the same element all the
 * way, so choosing another plate while one is in flight sends the first back from where it is.
 */
export function Plates({ skin, onSkin }: PlatesProps) {
  /** The plate that is out over the page, if any. */
  const [out, setOut] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const latest = useRef({ out, skin });
  latest.current = { out, skin };

  const commit = useCallback((id: string) => {
    if (latest.current.out !== id) return;
    const next = SKINS.find((item) => item.id === id);
    const home = () => window.setTimeout(() => setOut((current) => (current === id ? null : current)), REST_MS);
    if (next && next.id !== latest.current.skin.id) onSkin(next, home);
    else home();
  }, [onSkin]);

  // While a plate is out, watch its measured box, and change the page the moment it is hidden.
  useEffect(() => {
    if (!out) return undefined;
    let frame = 0;
    let done = false;
    const watch = () => {
      const node = nodes.current.get(out);
      if (node && !done && covers(node.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight })) {
        done = true;
        commit(out);
        return;
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !done) setOut(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [out, commit]);

  const choose = (item: Skin) => {
    // With reduced motion nothing travels, so the page just changes.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOut(null);
      if (item.id !== skin.id) onSkin(item);
      return;
    }
    // Pressing the plate that is in flight calls it back, and so does choosing the skin already on.
    if (out === item.id) setOut(null);
    else if (item.id === skin.id && out === null) return;
    else setOut(item.id);
  };

  return (
    <div className="plates" role="group" aria-label="Recipe and theme">
      {SKINS.map((item) => (
        <div className="plate-cell" key={item.id}>
          <Surface className="plate" shape={out === item.id ? 'page' : 'plate'} data-q-recipe={item.recipe} data-q-theme={item.theme} data-on={skin.id === item.id || undefined}
            ref={(node) => { if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id); }}>
            <button type="button" className="plate-face" aria-pressed={skin.id === item.id} onClick={() => choose(item)} data-testid={`skin-${item.id}`}>
              <span className="plate-name"><b>{item.name}</b> {item.tone}</span>
              <span className="plate-letters" aria-hidden="true">Aa</span>
              <span className="plate-row" aria-hidden="true">
                <span className="plate-button">Save</span>
                <span className="plate-ghost">Cancel</span>
              </span>
              <span className="plate-text">{item.text}</span>
            </button>
            <p className="plate-title" aria-hidden="true"><span>{item.name}</span><span>{item.tone}</span></p>
          </Surface>
        </div>
      ))}
    </div>
  );
}
