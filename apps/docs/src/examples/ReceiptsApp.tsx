import { ActionBar, Button, Field, Input, Inspector, Select, Tabs, Timeline, Tooltip } from '@qbeka/react';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { balanceCents, describeBalance, PAYERS, RECEIPTS, SPLITS, type Receipt, type ReceiptState } from './receipts-data';

function ReviewPanel({ receipt, onChange, onDecide }: { receipt: Receipt; onChange: (next: Receipt) => void; onDecide: (state: ReceiptState) => void }) {
  const [amount, setAmount] = useState(receipt.amount);
  const invalid = !/^\d+(\.\d{1,2})?$/.test(amount.trim());
  const commitAmount = () => {
    if (!invalid) onChange({ ...receipt, amount: amount.trim() });
  };
  return (
    <div className="ex-review">
      <div className="ex-review-head">
        <h2>{receipt.merchant}</h2>
        <Inspector.Close className="q-button" data-variant="ghost" aria-label="Close review">Close</Inspector.Close>
      </div>
      <Tabs.Root defaultValue="edit">
        <Tabs.List aria-label="Receipt sections">
          <Tabs.Tab value="edit">Edit</Tabs.Tab>
          <Tabs.Tab value="rule">Why it was flagged</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="edit">
          <div className="ex-grid">
            <Field.Root invalid={invalid} className="ex-span">
              <Field.Label>Amount in dollars</Field.Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={commitAmount} />
              {invalid ? <Field.Error match>Use dollars and cents, like 42.18.</Field.Error> : null}
            </Field.Root>
            <Field.Root>
              <Field.Label nativeLabel={false} render={<span />}>Paid by</Field.Label>
              <Select items={PAYERS} value={receipt.paidBy} onValueChange={(paidBy) => paidBy && onChange({ ...receipt, paidBy: paidBy as Receipt['paidBy'] })} />
            </Field.Root>
            <Field.Root>
              <Field.Label nativeLabel={false} render={<span />}>Split</Field.Label>
              <Select items={SPLITS} value={receipt.split} onValueChange={(split) => split && onChange({ ...receipt, split: split as Receipt['split'] })} />
            </Field.Root>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="rule">
          <p className="ex-prose">This synthetic receipt is in the queue because nobody has confirmed the split yet. In a real product, this tab would explain the rule that flagged it.</p>
        </Tabs.Panel>
      </Tabs.Root>
      <div className="ex-actions">
        <Button variant="primary" disabled={invalid} onClick={() => { commitAmount(); onDecide('approved'); }}>Approve</Button>
        <Button variant="danger" onClick={() => onDecide('rejected')}>Reject</Button>
      </div>
    </div>
  );
}

function ReceiptRow({ receipt, selected, onSelect, onChange, onDecide, fallbackFocusRef }: { receipt: Receipt; selected: boolean; onSelect: (selected: boolean) => void; onChange: (next: Receipt) => void; onDecide: (state: ReceiptState) => void; fallbackFocusRef: RefObject<HTMLElement | null> }) {
  const [open, setOpen] = useState(false);
  const decide = (state: ReceiptState) => {
    onDecide(state);
    setOpen(false);
  };
  return (
    <div className={`ex-receipt${selected ? ' is-selected' : ''}`} data-testid={`receipt-${receipt.id}`}>
      <input type="checkbox" className="ex-receipt-check" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${receipt.merchant}`} />
      <Inspector.Root modal open={open} onOpenChange={setOpen} fallbackFocusRef={fallbackFocusRef}>
        <Inspector.Trigger className="ex-receipt-trigger">
          <span className="ex-row-name"><span className="d-visually-hidden">Review </span>{receipt.merchant}</span>
          <span className="ex-row-meta">Oct {receipt.day}</span>
          <span className="ex-row-meta">{receipt.paidBy === 'you' ? 'You paid' : 'Sam paid'}</span>
          <span className="ex-row-meta ex-row-budget">${receipt.amount}</span>
          <span className="ex-pill" data-state={receipt.state}>{receipt.state}</span>
        </Inspector.Trigger>
        <Inspector.Panel label={`Review ${receipt.merchant}`}>
          <ReviewPanel receipt={receipt} onChange={onChange} onDecide={decide} />
        </Inspector.Panel>
      </Inspector.Root>
    </div>
  );
}

export function ReceiptsApp() {
  const [receipts, setReceipts] = useState(RECEIPTS);
  const [selected, setSelected] = useState<string[]>([]);
  const [undoStack, setUndoStack] = useState<Receipt[][]>([]);
  const [day, setDay] = useState(31);
  const [filter, setFilter] = useState('all');
  const headingRef = useRef<HTMLHeadingElement>(null);

  const remember = () => setUndoStack((stack) => [...stack.slice(-19), receipts]);

  const update = (next: Receipt) => {
    remember();
    setReceipts((list) => list.map((r) => (r.id === next.id ? next : r)));
  };

  const decide = (ids: string[], state: ReceiptState) => {
    remember();
    setReceipts((list) => list.map((r) => (ids.includes(r.id) ? { ...r, state } : r)));
    setSelected((list) => list.filter((id) => !ids.includes(id)));
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setReceipts(previous);
    setUndoStack((stack) => stack.slice(0, -1));
  };

  const visible = useMemo(() => receipts.filter((r) => filter === 'all' || r.state === filter), [receipts, filter]);
  const markers = useMemo(() => receipts.filter((r) => r.state === 'approved').map((r) => ({ value: r.day, label: `${r.merchant}, Oct ${r.day}` })), [receipts]);

  return (
    <section className="ex-app">
      <header className="ex-app-head">
        <h1 ref={headingRef} tabIndex={-1}>Receipts, October</h1>
        <div className="ex-app-tools">
          <Select aria-label="Filter receipts" className="ex-filter" items={[{ value: 'all', label: 'All receipts' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} value={filter} onValueChange={(v) => v && setFilter(v)} />
          <Tooltip content="Reverts your last change"><Button variant="ghost" disabled={undoStack.length === 0} onClick={undo}>Undo</Button></Tooltip>
        </div>
      </header>

      <div className="ex-balance">
        <p className="ex-balance-line" data-testid="balance">{describeBalance(balanceCents(receipts, day))}<span> Through October {day}, approved receipts only.</span></p>
        <Timeline label="Balance through the month" min={1} max={31} value={day} onValueChange={setDay} markers={markers} formatValue={(v) => `Oct ${v}`} rate={6} />
      </div>

      <div className="ex-list" data-testid="receipt-list">
        {visible.map((receipt) => (
          <ReceiptRow key={receipt.id} receipt={receipt} selected={selected.includes(receipt.id)} onSelect={(on) => setSelected((list) => (on ? [...list, receipt.id] : list.filter((id) => id !== receipt.id)))} onChange={update} onDecide={(state) => decide([receipt.id], state)} fallbackFocusRef={headingRef} />
        ))}
        {visible.length === 0 ? <p className="ex-empty">No receipts match this filter.</p> : null}
      </div>

      <ActionBar.Root open={selected.length > 0} label="Receipt actions" status={selected.length ? `${selected.length} selected` : ''} fallbackFocusRef={headingRef}>
        <ActionBar.Action onClick={() => decide(selected, 'approved')}>Approve</ActionBar.Action>
        <ActionBar.Action onClick={() => decide(selected, 'rejected')}>Reject</ActionBar.Action>
        <ActionBar.Action onClick={() => setSelected([])}>Clear</ActionBar.Action>
      </ActionBar.Root>
    </section>
  );
}
