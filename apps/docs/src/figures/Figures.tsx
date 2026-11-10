import type { CSSProperties, ReactNode } from 'react';
import { BROWSER_TESTS, BUDGETS, CLEAN_INSTALLS, FIRST_CHANGE_MS, IMPLEMENTATIONS, LAYOUT_COUNT, MUTATION, RUNS_PER_SCENARIO, SCENARIOS, SIZES, kilobytes } from './results';
import './figures.css';

const number = (value: number) => value.toLocaleString('en-US');

export function Figure({ id, label, caption, children, wide = false }: { id: string; label: string; caption: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <figure className="fig" id={id} data-wide={wide || undefined} data-testid={id}>
      <div className="fig-plate">{children}</div>
      <figcaption><b>{label}</b>{caption}</figcaption>
    </figure>
  );
}

/** Every run of the comparison suite as one mark: 8 scenarios, 5 implementations, 5 runs each. */
export function SuiteFigure() {
  return (
    <div className="fig-suite" role="table" aria-label="Runs with a violation, by scenario and implementation">
      <div className="fig-suite-row fig-suite-head" role="row">
        <span role="columnheader" className="fig-suite-name">Scenario</span>
        {IMPLEMENTATIONS.map((impl) => <span key={impl.id} role="columnheader" data-own={impl.own || undefined} data-tie={impl.id === 'surface' || impl.id === 'motion-measured' || undefined}>{impl.name}</span>)}
      </div>
      {SCENARIOS.map((scenario) => (
        <div className="fig-suite-row" role="row" key={scenario.id}>
          <span role="rowheader" className="fig-suite-name">{scenario.name}</span>
          {IMPLEMENTATIONS.map((impl) => {
            const failed = scenario.failed[impl.id];
            const runs = failed?.runs ?? 0;
            return (
              <span key={impl.id} role="cell" className="fig-suite-cell" data-tie={impl.id === 'surface' || impl.id === 'motion-measured' || undefined} aria-label={runs === 0 ? `Clean in ${RUNS_PER_SCENARIO} of ${RUNS_PER_SCENARIO} runs` : `A ${failed?.kind} in ${runs} of ${RUNS_PER_SCENARIO} runs`}>
                <span className="fig-runs" aria-hidden="true">{Array.from({ length: RUNS_PER_SCENARIO }, (_, run) => <i key={run} data-bad={run < runs || undefined} />)}</span>
                {failed ? <em aria-hidden="true">{failed.kind}</em> : null}
              </span>
            );
          })}
        </div>
      ))}
      <div className="fig-suite-row fig-suite-foot" role="row">
        <span role="rowheader" className="fig-suite-name">Runs with a violation</span>
        {IMPLEMENTATIONS.map((impl) => {
          const total = SCENARIOS.reduce((sum, scenario) => sum + (scenario.failed[impl.id]?.runs ?? 0), 0);
          return <span key={impl.id} role="cell" data-tie={impl.id === 'surface' || impl.id === 'motion-measured' || undefined}><b>{total}</b> of {SCENARIOS.length * RUNS_PER_SCENARIO}</span>;
        })}
      </div>
      <p className="fig-tie" aria-hidden="true"><span>A tie</span></p>
    </div>
  );
}

/** One import of each, to one scale. */
export function SizeFigure() {
  const largest = Math.max(...SIZES.map((size) => size.bytes));
  return (
    <ul className="fig-bars" aria-label="Gzipped size of one import">
      {SIZES.map((size) => (
        <li key={size.id} data-own={size.own || undefined} data-first={size.id === 'surface' || undefined}>
          <span className="fig-bars-name">{size.name}{size.note ? <small> {size.note}</small> : null}</span>
          <span className="fig-bars-track"><i style={{ '--share': size.bytes / largest } as CSSProperties} /></span>
          <span className="fig-bars-value">{kilobytes(size.bytes)} KB</span>
        </li>
      ))}
    </ul>
  );
}

/** Click to first change, as a range with its median, and how many layouts each one did. */
export function TimingFigure() {
  const scale = 30;
  const most = Math.max(...Object.values(LAYOUT_COUNT).map((count) => count.max));
  return (
    <div className="fig-timing">
      <div className="fig-timing-part">
        <p className="fig-part-title">Click to first change from rest, in milliseconds</p>
        <ul className="fig-ranges">
          {IMPLEMENTATIONS.map((impl) => {
            const time = FIRST_CHANGE_MS[impl.id];
            return (
              <li key={impl.id} data-own={impl.own || undefined}>
                <span className="fig-ranges-name">{impl.name}</span>
                <span className="fig-ranges-track" style={{ '--min': time.min / scale, '--max': time.max / scale, '--median': time.median / scale } as CSSProperties} role="img" aria-label={`Median ${time.median.toFixed(1)}, range ${time.min.toFixed(1)} to ${time.max.toFixed(1)} milliseconds`}><i /><b /></span>
                <span className="fig-ranges-value">{time.median.toFixed(1)}</span>
              </li>
            );
          })}
        </ul>
        <p className="fig-axis" aria-hidden="true"><span>0</span><span>10</span><span>20</span><span>30 ms</span></p>
      </div>
      <div className="fig-timing-part">
        <p className="fig-part-title">Layouts in the reversal workload, where fewer is cheaper</p>
        <ul className="fig-bars fig-bars-tight">
          {IMPLEMENTATIONS.map((impl) => {
            const layouts = LAYOUT_COUNT[impl.id];
            return (
              <li key={impl.id} data-own={impl.own || undefined} data-most={layouts.median === most || undefined}>
                <span className="fig-bars-name">{impl.name}</span>
                <span className="fig-bars-track"><i style={{ '--share': layouts.median / most } as CSSProperties} /></span>
                <span className="fig-bars-value">{layouts.median}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** How far each measurement is toward its limit. A miss runs past the line. */
function budgetShare(value: number, limit: number) {
  if (limit === 0) return value === 0 ? 0 : 1.2;
  return Math.min(Math.max(value / limit, 0), 1.2);
}

export function BudgetFigure() {
  const met = BUDGETS.filter((budget) => budget.met).length;
  return (
    <div className="fig-budgets">
      <p className="fig-budget-tally" aria-label={`${met} of ${BUDGETS.length} budgets met`}>
        <span className="fig-budget-count"><b>{met}</b> of {BUDGETS.length} met</span>
        <span className="fig-budget-squares" aria-hidden="true">{BUDGETS.map((budget) => <i key={budget.name} data-missed={!budget.met || undefined} />)}</span>
      </p>
      <ul>
        {BUDGETS.map((budget) => (
          <li key={budget.name} data-missed={!budget.met || undefined}>
            <span className="fig-budget-name">{budget.name}</span>
            <span className="fig-budget-track" role="img" aria-label={`${number(budget.value)} against a limit of ${number(budget.limit)} ${budget.unit}`}><i style={{ '--share': budgetShare(budget.value, budget.limit) } as CSSProperties} /></span>
            <span className="fig-budget-value"><b>{number(budget.value)}</b> of {number(budget.limit)} {budget.unit}</span>
            <span className="fig-budget-result">{budget.met ? 'Met' : 'Missed'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Three counts, each drawn as what was counted. */
export function TallyFigure() {
  return (
    <dl className="fig-tallies">
      <div>
        <dt>Deliberate defects caught</dt>
        <dd><b>{MUTATION.caught}</b> of {MUTATION.total}</dd>
        <dd className="fig-squares" aria-hidden="true">{Array.from({ length: MUTATION.total }, (_, index) => <i key={index} data-open={index >= MUTATION.caught || undefined} />)}</dd>
        <dd className="fig-tally-note">I judged the other {MUTATION.equivalent} equivalent from reading the code</dd>
      </div>
      <div>
        <dt>Clean installs of the packed release</dt>
        <dd><b>{CLEAN_INSTALLS.passed}</b> of {CLEAN_INSTALLS.total}</dd>
        <dd className="fig-squares fig-squares-large" aria-hidden="true">{Array.from({ length: CLEAN_INSTALLS.total }, (_, index) => <i key={index} />)}</dd>
        <dd className="fig-tally-note">React 18.3.1, 19.0.0 and 19.3.1, with Vite 8 and Next 16</dd>
      </div>
      <div>
        <dt>Browser tests, three full runs in a row</dt>
        <dd><b>{number(BROWSER_TESTS.total)}</b> passed</dd>
        <dd className="fig-split" aria-hidden="true">
          <i style={{ '--share': BROWSER_TESTS.chromium / BROWSER_TESTS.total } as CSSProperties} />
          <i style={{ '--share': BROWSER_TESTS.firefox / BROWSER_TESTS.total } as CSSProperties} />
          <i style={{ '--share': BROWSER_TESTS.webkit / BROWSER_TESTS.total } as CSSProperties} />
          <i style={{ '--share': BROWSER_TESTS.strictMode / BROWSER_TESTS.total } as CSSProperties} />
        </dd>
        <dd className="fig-tally-note">{BROWSER_TESTS.chromium} in Chromium, {BROWSER_TESTS.firefox} in Firefox, {BROWSER_TESTS.webkit} in WebKit and {BROWSER_TESTS.strictMode} in StrictMode</dd>
      </div>
    </dl>
  );
}
