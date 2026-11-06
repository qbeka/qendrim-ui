import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Dialog, Popover, Select } from '@qbeka/react';

/**
 * Benchmark fixture. The same interaction, once through this library and once through the
 * Base UI primitive directly, with the same class names and CSS. It measures what the
 * wrappers add, so the direct version must not skip any work the wrapper does.
 */

const ITEMS = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }];

function QDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger data-probe="trigger">Open</Dialog.Trigger>
      <Dialog.Content title="Sample" data-probe="popup"><Dialog.Close data-probe="close">Close</Dialog.Close></Dialog.Content>
    </Dialog.Root>
  );
}

function DirectDialog() {
  return (
    <BaseDialog.Root>
      <BaseDialog.Trigger data-probe="trigger">Open</BaseDialog.Trigger>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="q-dialog-backdrop" />
        <BaseDialog.Popup className="q-dialog" data-probe="popup">
          <BaseDialog.Title className="q-dialog-title">Sample</BaseDialog.Title>
          <BaseDialog.Close data-probe="close">Close</BaseDialog.Close>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

function QPopover() {
  return (
    <Popover.Root>
      <Popover.Trigger data-probe="trigger">Open</Popover.Trigger>
      <Popover.Content title="Sample" data-probe="popup"><Popover.Close data-probe="close">Close</Popover.Close></Popover.Content>
    </Popover.Root>
  );
}

function DirectPopover() {
  return (
    <BasePopover.Root>
      <BasePopover.Trigger data-probe="trigger">Open</BasePopover.Trigger>
      <BasePopover.Portal>
        <BasePopover.Positioner className="q-popup-positioner" sideOffset={6} collisionPadding={8}>
          <BasePopover.Popup className="q-popup q-popover" data-probe="popup">
            <BasePopover.Title className="q-popup-title">Sample</BasePopover.Title>
            <BasePopover.Close data-probe="close">Close</BasePopover.Close>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

function QSelect() {
  return <Select data-probe="trigger" aria-label="Sample" items={ITEMS} defaultValue="a" />;
}

function DirectSelect() {
  return (
    <BaseSelect.Root items={ITEMS} defaultValue="a">
      <BaseSelect.Trigger aria-label="Sample" className="q-select-trigger" data-probe="trigger">
        <BaseSelect.Value placeholder="Choose" />
        <BaseSelect.Icon className="q-select-icon" aria-hidden>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.25" /></svg>
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="q-popup-positioner" sideOffset={4} alignItemWithTrigger={false}>
          <BaseSelect.Popup className="q-popup q-select-popup">
            <BaseSelect.List>
              {ITEMS.map((item) => (
                <BaseSelect.Item key={item.value} value={item.value} className="q-select-item">
                  <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="q-select-indicator" aria-hidden>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1.5" stroke="currentColor" strokeWidth="1.5" /></svg>
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

const CASES = { 'dialog-q': QDialog, 'dialog-base': DirectDialog, 'popover-q': QPopover, 'popover-base': DirectPopover, 'select-q': QSelect, 'select-base': DirectSelect };

export function FoundationCompare() {
  const name = new URLSearchParams(window.location.search).get('case') as keyof typeof CASES;
  const Case = CASES[name];
  return <main style={{ padding: 40 }}>{Case ? <Case /> : <p>Unknown case.</p>}</main>;
}
