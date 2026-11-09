import { COMPONENTS } from './components';
import { GUIDES } from './guides';

export interface NavItem {
  to: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const component = (group: 'Signature' | 'Foundation') => COMPONENTS.filter((doc) => doc.group === group).map((doc) => ({ to: `/components/${doc.slug}`, label: doc.name }));

/** The whole site, in reading order. The side navigation, the menu and the pager all use it. */
export const NAV: NavGroup[] = [
  { title: 'Start', items: [{ to: '/', label: 'Overview' }, ...GUIDES.map((guide) => ({ to: `/guide/${guide.slug}`, label: guide.title }))] },
  { title: 'Signature components', items: [{ to: '/components', label: 'All components' }, ...component('Signature')] },
  { title: 'Foundation components', items: component('Foundation') },
  { title: 'Examples', items: [{ to: '/examples/projects', label: 'Project inspector' }, { to: '/examples/receipts', label: 'Receipt review' }] },
  { title: 'Proof', items: [{ to: '/workbench', label: 'Workbench' }, { to: '/evidence', label: 'Evidence' }] },
];

const FLAT = NAV.flatMap((group) => group.items);

export const pageLabel = (path: string) => FLAT.find((item) => item.to === path)?.label ?? null;

/** The pages before and after this one, for the links at the foot of a page. */
export function neighbors(path: string) {
  const index = FLAT.findIndex((item) => item.to === path);
  if (index === -1) return { previous: null, next: null };
  return { previous: FLAT[index - 1] ?? null, next: FLAT[index + 1] ?? null };
}
