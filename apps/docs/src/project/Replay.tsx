import { Input } from '@qbeka/react/input';
import { Inspector } from '@qbeka/react/inspector';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trajectory } from '../lib/Trajectory';

const NAME = 'Harbor rebuild';
const FIRST = ', phase two';
const SECOND = ' north';
const PER_KEY = 70;
const FIRST_AT = 1100;
const SECOND_AT = 4600;
const DETAILS_AT = 6000;
const NARROW_AT = 7400;
const DURATION = 12000;
const UNLOCK_AFTER = 700;

/** Every request the replay makes. The reversals are 160 ms apart, so each lands mid-move. */
const REQUESTS: [number, boolean][] = [[900, true], [2900, false], [3060, true], [3220, false], [3380, true], [8800, false], [10200, true]];

const STEPS = [
  { at: 0, title: 'A row in a list', body: 'Press Play. This is the real component running on this page, not a recording.' },
  { at: 900, title: 'It opens', body: 'The row grows into an editor. It stays one element, so nothing is copied and no field remounts.' },
  { at: FIRST_AT, title: 'Type during the move', body: 'The field is ready as soon as the panel starts to open. There is no waiting for the animation.' },
  { at: 2900, title: 'Reverse it, twice', body: 'Close, open, close, open, 160 ms apart. The newest request wins, and each move starts from what is on screen, at the speed it is already going.' },
  { at: SECOND_AT, title: 'Keep typing', body: 'The text is still there, because it was the same input the whole time.' },
  { at: DETAILS_AT, title: 'The content grows', body: 'New fields appear, so the target height changes. The panel changes course without a jump and without stretching its text.' },
  { at: NARROW_AT, title: 'The layout narrows', body: 'The container gets narrower and the panel follows its new box.' },
  { at: 8800, title: 'Close it and reopen', body: 'Everything you typed comes back with it.' },
  { at: 11000, title: 'Your turn', body: 'Nothing is locked. Click the row, type in it and change your mind.' },
] as const;

/** Runs after the frame, so a read sees what was painted and not a layout that never reached the screen. */
function afterFrame(read: () => void) {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    channel.port1.close();
    read();
  };
  channel.port2.postMessage(0);
}

const openAt = (t: number) => REQUESTS.reduce((open, [at, next]) => (t >= at ? next : open), false);
const typed = (text: string, from: number, t: number) => text.slice(0, Math.max(0, Math.floor((t - from) / PER_KEY)));
const textAt = (t: number) => `${NAME}${typed(FIRST, FIRST_AT, t)}${typed(SECOND, SECOND_AT, t)}`;
const stepAt = (t: number) => STEPS.reduce((index, step, i) => (t >= step.at ? i : index), 0);

/** Replays a scripted session on the real Inspector. All of its state is a function of one time. */
export function Replay() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const clock = useRef({ frame: 0, startedAt: 0, from: 0 });

  const pause = useCallback(() => {
    cancelAnimationFrame(clock.current.frame);
    setPlaying(false);
  }, []);

  const seek = useCallback((t: number) => {
    // The panel takes focus when it opens, and that would scroll the page and pull focus off
    // the replay controls. While the replay drives it, the stage is inert, so a watcher's page
    // stays still. It unlocks once the move is over, or as soon as they press on it.
    setLocked(true);
    setTime(t);
    setOpen(openAt(t));
    if (input.current) input.current.value = textAt(t);
  }, []);

  const play = () => {
    const from = time >= DURATION ? 0 : time;
    if (from === 0) setPoints([]);
    seek(from);
    clock.current.startedAt = performance.now();
    clock.current.from = from;
    setPlaying(true);
    const tick = (now: number) => {
      const t = clock.current.from + now - clock.current.startedAt;
      seek(Math.min(t, DURATION));
      afterFrame(() => {
        const box = stage.current?.querySelector<HTMLElement>('[data-q-surface]');
        if (box) setPoints((p) => [...p.slice(-899), box.getBoundingClientRect().height]);
      });
      if (t < DURATION) clock.current.frame = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    clock.current.frame = requestAnimationFrame(tick);
  };

  useEffect(() => () => cancelAnimationFrame(clock.current.frame), []);

  useEffect(() => {
    if (playing || !locked) return undefined;
    const id = setTimeout(() => setLocked(false), UNLOCK_AFTER);
    return () => clearTimeout(id);
  }, [playing, locked, time]);

  const step = stepAt(time);
  const current = STEPS[step] ?? STEPS[0];
  const go = (index: number) => {
    pause();
    seek((STEPS[index] ?? STEPS[0]).at);
  };

  return (
    <div className="p-card" data-testid="replay">
      <div aria-live="polite">
        <div className="p-step-label">Step {step + 1} of {STEPS.length}</div>
        <div className="p-step-title">{current.title}</div>
        <p className="p-step-body">{current.body}</p>
      </div>

      <div className="p-stage" ref={stage} data-testid="replay-stage" onPointerDownCapture={() => { pause(); setLocked(false); }}>
        <div className="p-stage-inner" data-narrow={time >= NARROW_AT || undefined} inert={locked}>
          <Inspector.Root open={open} onOpenChange={(next) => { pause(); setOpen(next); }} className="p-row">
            <Inspector.Trigger>
              <span className="p-row-name">Harbor rebuild</span>
              <span className="p-row-meta">Active</span>
            </Inspector.Trigger>
            <Inspector.Panel label="Edit Harbor rebuild">
              <div className="p-editor">
                <label className="p-field">Name<Input ref={input} defaultValue={NAME} data-testid="replay-input" /></label>
                <label className="p-field">Budget in dollars<Input defaultValue="1200000" inputMode="numeric" /></label>
                {time >= DETAILS_AT ? (
                  <label className="p-field">Notes<Input defaultValue="Pier survey comes first." /></label>
                ) : null}
                <Inspector.Close className="q-button" data-variant="ghost">Close</Inspector.Close>
              </div>
            </Inspector.Panel>
          </Inspector.Root>
          <div className="p-row-after" aria-hidden>Field survey<span>Paused</span></div>
        </div>
      </div>

      <figure className="p-line">
        <Trajectory points={points} width={640} height={56} />
        <figcaption>Height of the panel above, measured on each frame of this run. The line at the top of this page is one such run.</figcaption>
      </figure>

      <div className="p-controls">
        <button className="p-dark" type="button" onClick={playing ? pause : play} data-testid="replay-play">{playing ? 'Pause' : time >= DURATION ? 'Replay' : 'Play'}</button>
        <button type="button" onClick={() => go(Math.max(0, step - 1))} aria-label="Back one step">Back</button>
        <button type="button" onClick={() => go(Math.min(STEPS.length - 1, step + 1))} aria-label="Next step">Next</button>
        <input type="range" min={0} max={DURATION} step={10} value={Math.round(time)} aria-label="Replay position" onChange={(e) => { pause(); seek(Number(e.target.value)); }} />
      </div>
    </div>
  );
}
