/**
 * Synthetic data in the shape of a shared-money app. Every merchant, person and amount here
 * is invented. No customer data was used.
 */

export type ReceiptState = 'pending' | 'approved' | 'rejected';

export interface Receipt {
  id: string;
  merchant: string;
  amount: string;
  paidBy: 'you' | 'sam';
  split: 'even' | 'you' | 'sam';
  day: number;
  state: ReceiptState;
}

export const RECEIPTS: Receipt[] = [
  { id: 'r1', merchant: 'Harbor Grocer', amount: '42.18', paidBy: 'sam', split: 'even', day: 3, state: 'pending' },
  { id: 'r2', merchant: 'Night Train Tickets', amount: '9.50', paidBy: 'you', split: 'even', day: 7, state: 'pending' },
  { id: 'r3', merchant: 'Corner Pharmacy', amount: '17.25', paidBy: 'you', split: 'you', day: 11, state: 'approved' },
  { id: 'r4', merchant: 'North Line Power and Water', amount: '86.40', paidBy: 'sam', split: 'even', day: 15, state: 'pending' },
  { id: 'r5', merchant: 'Bright Bakery', amount: '12.60', paidBy: 'you', split: 'even', day: 22, state: 'pending' },
  { id: 'r6', merchant: 'Tide Hardware', amount: '31.05', paidBy: 'sam', split: 'sam', day: 26, state: 'rejected' },
];

export const PAYERS = [
  { value: 'you', label: 'You' },
  { value: 'sam', label: 'Sam' },
];

export const SPLITS = [
  { value: 'even', label: 'Split evenly' },
  { value: 'you', label: 'All yours' },
  { value: 'sam', label: 'All Sam' },
];

/** What Sam owes you, in cents, counting only approved receipts up to a day. Negative means you owe Sam. */
export function balanceCents(receipts: readonly Receipt[], throughDay = 31) {
  let cents = 0;
  for (const receipt of receipts) {
    if (receipt.state !== 'approved' || receipt.day > throughDay) continue;
    const amount = Math.round(Number(receipt.amount) * 100);
    if (receipt.paidBy === 'you') cents += receipt.split === 'even' ? amount / 2 : receipt.split === 'sam' ? amount : 0;
    else cents -= receipt.split === 'even' ? amount / 2 : receipt.split === 'you' ? amount : 0;
  }
  return Math.round(cents);
}

export function describeBalance(cents: number) {
  const dollars = (Math.abs(cents) / 100).toFixed(2);
  if (cents === 0) return 'You and Sam are even.';
  return cents > 0 ? `Sam owes you $${dollars}.` : `You owe Sam $${dollars}.`;
}
