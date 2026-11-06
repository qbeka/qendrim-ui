/** Synthetic data. These projects, people and numbers are invented for this demo. */

export type Status = 'active' | 'paused' | 'done';

export interface Project {
  id: string;
  name: string;
  owner: string;
  status: Status;
  budget: string;
  due: string;
  notes: string;
}

export const OWNERS = [
  { value: 'mira', label: 'Mira Okafor' },
  { value: 'dan', label: 'Dan Hollis' },
  { value: 'yuki', label: 'Yuki Tanaka' },
  { value: 'lena', label: 'Lena Brandt' },
];

export const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'done', label: 'Done' },
];

export const PROJECTS: Project[] = [
  { id: 'harbor', name: 'Harbor rebuild', owner: 'mira', status: 'active', budget: '1200000', due: '12 Jan', notes: 'Pier survey comes first. Dredging waits for the tide tables.' },
  { id: 'survey', name: 'Field survey', owner: 'dan', status: 'paused', budget: '84000', due: '3 Feb', notes: 'Paused until the access road reopens.' },
  { id: 'signal', name: 'Signal retrofit for the north line, including the two freight sidings and the depot', owner: 'yuki', status: 'active', budget: '460500', due: '28 Feb', notes: 'Long names must wrap in the row and in the panel.' },
  { id: 'archive', name: 'Records archive', owner: 'lena', status: 'done', budget: '39000', due: '9 Nov', notes: 'Delivered. Keep for the audit.' },
];
