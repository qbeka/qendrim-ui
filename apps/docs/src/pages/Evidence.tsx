import { useEffect, useState } from 'react';
import { BudgetFigure, Figure, SizeFigure, SuiteFigure, TallyFigure, TimingFigure } from '../figures/Figures';

interface Row {
  [key: string]: string | number | null;
}

interface Table {
  id: string;
  title: string;
  note: string;
  columns: string[];
  rows: Row[];
}

interface Summary {
  measuredAt: string;
  environment: string;
  sections: Table[];
  limits: string[];
}

export function Evidence() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}evidence.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('missing'))))
      .then(setSummary)
      .catch(() => setMissing(true));
  }, []);
  return (
    <div className="d-wide">
      <h1>Evidence</h1>
      <p className="d-lede">These are measurements from recorded runs. The raw samples and a manifest for each run are in the repository, under results.</p>
      <div className="d-figures">
        <Figure id="figure-suite" label="Figure 1" wide caption="Each mark is one run and a filled square is a run with a violation, on one panel shape in one layout, where Surface and the measured Motion version were both clean in all 40">
          <SuiteFigure />
        </Figure>
        <Figure id="figure-size" label="Figure 2" wide caption="Gzipped JavaScript for one import with React excluded, and if your app already ships Motion that cost is zero to you">
          <SizeFigure />
        </Figure>
        <Figure id="figure-timing" label="Figure 3" wide caption="Median and range of 6 runs, where the ranges of Surface and the Motion versions overlap, so it is level and no faster, and Surface does more layouts than any baseline">
          <TimingFigure />
        </Figure>
        <Figure id="figure-budgets" label="Figure 4" wide caption="Each bar is a measurement against its own limit, which is the line, so a bar that crosses the line is a miss">
          <BudgetFigure />
        </Figure>
        <Figure id="figure-tallies" label="Figure 5" wide caption="The suite itself was checked by breaking the library on purpose, one defect at a time, and the packed release was installed into clean apps">
          <TallyFigure />
        </Figure>
      </div>
      <h2>The tables</h2>
      <p>Every number in the figures, and the ones they leave out, as recorded.</p>
      {missing ? <p>No results have been published with this build. Run <code>pnpm bench</code> to produce them.</p> : null}
      {summary ? (
        <>
          <p className="d-note">Measured {summary.measuredAt}. {summary.environment}</p>
          {summary.sections.map((section) => (
            <section key={section.id}>
              <h2>{section.title}</h2>
              <p>{section.note}</p>
              <div className="d-table">
                <table>
                  <thead><tr>{section.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>{section.rows.map((row, i) => <tr key={i}>{section.columns.map((c) => <td key={c} data-result={c === 'Result' ? String(row[c]) : undefined}>{row[c] ?? 'n/a'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </section>
          ))}
          <h2>What these numbers leave out</h2>
          <ul>{summary.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        </>
      ) : null}
    </div>
  );
}
