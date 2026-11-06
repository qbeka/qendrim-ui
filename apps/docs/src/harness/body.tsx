export interface BodyProps {
  value: string;
  onValue: (value: string) => void;
  details: boolean;
  error: boolean;
  onDetails: () => void;
}

/** The same content for every implementation: real controls, a scroller, growth on demand. */
export function FixtureBody({ value, onValue, details, error, onDetails }: BodyProps) {
  return (
    <div className="fx-body">
      <label>
        Project name
        <input data-probe="input" value={value} onChange={(e) => onValue(e.target.value)} aria-invalid={error || undefined} />
      </label>
      {error ? <p className="fx-error" role="alert">Budget must be a number.</p> : null}
      <label>
        Notes
        <textarea data-probe="textarea" defaultValue="The pier survey comes first. Dredging waits for the tide tables." rows={2} />
      </label>
      <div className="fx-scroller" data-probe="scroller" tabIndex={0} role="group" aria-label="Activity">
        {Array.from({ length: 24 }, (_, i) => <p key={i}>Entry {i + 1}: field note</p>)}
      </div>
      <button type="button" data-probe="details" onClick={onDetails}>{details ? 'Hide details' : 'Show details'}</button>
      {details ? <div className="fx-details" data-probe="details-block"><p>Owner: Field team</p><p>Region: North harbor</p><p>Contract: Fixed price</p><p>Review: Monthly</p></div> : null}
    </div>
  );
}
