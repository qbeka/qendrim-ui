import { useEffect, useState } from 'react';

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
      <p className="d-lede">Measurements from recorded runs. The raw samples and a manifest for each run are in the repository, under results.</p>
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
                  <tbody>{section.rows.map((row, i) => <tr key={i}>{section.columns.map((c) => <td key={c}>{row[c] ?? 'n/a'}</td>)}</tr>)}</tbody>
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
