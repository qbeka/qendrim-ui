'use client';

import { Slider } from '@base-ui/react/slider';
import { forwardRef, useCallback, useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react';

export interface TimelineMarker {
  value: number;
  label: string;
}

export interface TimelineProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Names the control, such as "Budget history". */
  label: string;
  min: number;
  max: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  markers?: readonly TimelineMarker[];
  /** Turns a value into words for screen readers and for the visible readout. */
  formatValue?: (value: number) => string;
  /** How far playback moves in one second, in value units. Defaults to a ten second run. */
  rate?: number;
}

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Keyboard-operable transport with markers. Base UI's Slider supplies the thumb, the
 * arrow keys, Home, End, Page Up, Page Down, pointer capture and the slider role. This
 * adds markers, the previous and next jumps, and playback.
 */
export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
  { label, min, max, step = 1, value: valueProp, defaultValue, onValueChange, markers = [], formatValue = String, rate, className, ...rest },
  ref,
) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? min);
  const value = valueProp ?? uncontrolled;
  const [playing, setPlaying] = useState(false);

  const latest = useRef({ value, onValueChange, controlled: valueProp !== undefined });
  latest.current = { value, onValueChange, controlled: valueProp !== undefined };

  const change = useCallback((next: number) => {
    if (!latest.current.controlled) setUncontrolled(next);
    latest.current.value = next;
    latest.current.onValueChange?.(next);
  }, []);

  const sorted = [...markers].sort((a, b) => a.value - b.value);
  const previousMarker = [...sorted].reverse().find((m) => m.value < value);
  const nextMarker = sorted.find((m) => m.value > value);

  useEffect(() => {
    if (!playing) return undefined;
    const speed = rate ?? (max - min) / 10;

    if (prefersReducedMotion()) {
      // Same information, no gliding: step from marker to marker once a second.
      const timer = setInterval(() => {
        const next = sorted.find((m) => m.value > latest.current.value)?.value ?? max;
        change(next);
        if (next >= max) setPlaying(false);
      }, 1000);
      return () => clearInterval(timer);
    }

    let frame = 0;
    let last = performance.now();
    let position = latest.current.value >= max ? min : latest.current.value;
    let emitted = position;
    const tick = (now: number) => {
      // A value we did not emit came from the user, so playback continues from there.
      if (latest.current.value !== emitted) position = latest.current.value;
      position = Math.min(position + speed * Math.max(now - last, 0) * 0.001, max);
      last = now;
      const snapped = step > 0 ? min + Math.round((position - min) / step) * step : position;
      emitted = position >= max ? max : Math.min(snapped, max);
      change(emitted);
      if (position >= max) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `sorted` is rebuilt each render. Playback only needs markers at the moment it reads them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, min, max, step, rate, change]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '[' && previousMarker) {
      event.preventDefault();
      change(previousMarker.value);
    } else if (event.key === ']' && nextMarker) {
      event.preventDefault();
      change(nextMarker.value);
    }
  };

  const percent = (v: number) => (max === min ? 0 : ((v - min) / (max - min)) * 100);

  return (
    <div {...rest} ref={ref} className={['q-timeline', className].filter(Boolean).join(' ')} role="group" aria-label={label} onKeyDown={onKeyDown}>
      <div className="q-timeline-transport">
        <button type="button" className="q-timeline-button" aria-label="Previous marker" disabled={!previousMarker} onClick={() => previousMarker && change(previousMarker.value)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M9 2L4 6l5 4M2.5 2v8" stroke="currentColor" strokeWidth="1.25" /></svg>
        </button>
        <button type="button" className="q-timeline-button" aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>
          {playing ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M4 2v8M8 2v8" stroke="currentColor" strokeWidth="1.5" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3.5 2l6 4-6 4V2z" stroke="currentColor" strokeWidth="1.25" /></svg>
          )}
        </button>
        <button type="button" className="q-timeline-button" aria-label="Next marker" disabled={!nextMarker} onClick={() => nextMarker && change(nextMarker.value)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden><path d="M3 2l5 4-5 4M9.5 2v8" stroke="currentColor" strokeWidth="1.25" /></svg>
        </button>
      </div>
      <Slider.Root className="q-timeline-slider" value={value} min={min} max={max} step={step} onValueChange={(next) => change(next as number)}>
        <Slider.Control className="q-timeline-control">
          <Slider.Track className="q-timeline-track">
            <Slider.Indicator className="q-timeline-indicator" />
            <Slider.Thumb className="q-timeline-thumb" aria-label={label} getAriaValueText={(_formatted, v) => formatValue(v)} />
          </Slider.Track>
          {markers.map((marker) => (
            // Pointer only: a marker in every tab stop would make the control slow to leave.
            // Keyboard users have the previous and next buttons, plus [ and ].
            <button key={`${marker.value}-${marker.label}`} type="button" tabIndex={-1} className="q-timeline-marker" style={{ insetInlineStart: `${percent(marker.value)}%` }} title={marker.label} aria-label={marker.label} data-passed={marker.value <= value ? '' : undefined} onClick={() => change(marker.value)} />
          ))}
        </Slider.Control>
      </Slider.Root>
      <output className="q-timeline-readout">{formatValue(value)}</output>
    </div>
  );
});
