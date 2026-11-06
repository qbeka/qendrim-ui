/** Made up for the demo, like the projects in the docs. */
export interface Row {
  id: string;
  name: string;
  lead: string;
  budget: string;
  status: string;
  due: string;
}

export const ROWS: Row[] = [
  { id: 'harbor', name: 'Harbor rebuild', lead: 'Mira Okafor', budget: '1200000', status: 'Active', due: '12 Jan' },
  { id: 'survey', name: 'Field survey', lead: 'Dan Hollis', budget: '84000', status: 'Paused', due: '3 Feb' },
  { id: 'signal', name: 'Signal retrofit', lead: 'Yuki Tanaka', budget: '460500', status: 'Active', due: '28 Feb' },
  { id: 'archive', name: 'Records archive', lead: 'Lena Brandt', budget: '39000', status: 'Done', due: '9 Nov' },
  { id: 'lights', name: 'Pier lighting', lead: 'Mira Okafor', budget: '22500', status: 'Active', due: '20 Mar' },
  { id: 'ferry', name: 'Ferry terminal roof', lead: 'Dan Hollis', budget: '318000', status: 'Paused', due: '2 Apr' },
  { id: 'gauge', name: 'Tide gauge install', lead: 'Yuki Tanaka', budget: '57200', status: 'Active', due: '16 Apr' },
  { id: 'quay', name: 'Quay wall repairs', lead: 'Lena Brandt', budget: '905000', status: 'Active', due: '30 May' },
];

/** What Add content puts in the panel, in order. */
export const EXTRA_LABELS = ['Site contact', 'Permit number', 'Next review'];

/** One extra field in one row. The value belongs to the visitor once they type in it. */
export interface Extra {
  key: number;
  label: string;
  value: string;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
export const formatBudget = (budget: string) => (/^\d+$/.test(budget) ? money.format(Number(budget)) : budget);
