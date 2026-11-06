import { expect, test } from '@playwright/test';

test.describe('project inspector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/projects');
  });

  const row = (page: import('@playwright/test').Page) => page.getByTestId('project-harbor');

  test('a validation error stops the save and moves focus to the field', async ({ page }) => {
    await row(page).getByRole('button').first().click();
    await row(page).getByLabel('Budget in dollars').fill('12a');
    await expect(page.getByText('Use whole dollars')).toBeVisible();
    await row(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row(page).getByLabel('Budget in dollars')).toBeFocused();
    await expect(page.getByText('Saved.')).toBeHidden();
  });

  test('saving shows progress, then offers undo', async ({ page }) => {
    await row(page).getByRole('button').first().click();
    await row(page).getByLabel('Name').fill('Harbor rebuild, phase two');
    await row(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saving…')).toBeVisible();
    await expect(page.getByText('Saved.')).toBeVisible();
    await expect(row(page).locator('.ex-row-name')).toHaveText('Harbor rebuild, phase two');
    await row(page).getByRole('button', { name: 'Undo' }).click();
    await expect(row(page).locator('.ex-row-name')).toHaveText('Harbor rebuild');
    await expect(row(page).getByLabel('Name')).toHaveValue('Harbor rebuild');
  });

  test('a failed save keeps the edit and says what to do', async ({ page }) => {
    await page.getByLabel('Fail saves').check();
    await row(page).getByRole('button').first().click();
    await row(page).getByLabel('Name').fill('Unsaved name');
    await row(page).getByRole('button', { name: 'Save and close' }).click();
    await expect(page.getByText('Not saved.')).toBeVisible();
    await expect(row(page).getByLabel('Name')).toHaveValue('Unsaved name');
    await expect(row(page).locator('.ex-row-name')).toHaveText('Harbor rebuild');
  });

  test('reopening during a slow save and close keeps the panel open', async ({ page }) => {
    await page.getByLabel('Slow saves').check();
    await row(page).getByRole('button').first().click();
    await row(page).getByRole('button', { name: 'Save and close' }).click();
    await row(page).getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForTimeout(100);
    await row(page).getByRole('button').first().click();
    await page.waitForTimeout(3000);
    await expect(row(page).getByLabel('Name')).toBeVisible();
  });

  test('diagnostics are off by default and report the real state when on', async ({ page }) => {
    await expect(page.getByTestId('diagnostics')).toHaveCount(0);
    await page.getByTestId('toggle-diagnostics').check();
    await row(page).getByRole('button').first().click();
    await expect(page.getByTestId('diag-requested')).toHaveText('open');
    await expect(page.getByTestId('diag-generation')).toHaveText('1');
    await expect(page.getByTestId('diag-focus')).toContainText('input');
  });

  test('archiving recovers focus, and undo restores the row', async ({ page }) => {
    await row(page).getByRole('button').first().click();
    await row(page).getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeFocused();
    await expect(row(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(row(page)).toHaveCount(1);
  });

  test('with every row archived, the empty state explains what to do', async ({ page }) => {
    for (const id of ['harbor', 'survey', 'signal', 'archive']) {
      const target = page.getByTestId(`project-${id}`);
      await target.getByRole('button').first().click();
      await target.getByRole('button', { name: 'Archive', exact: true }).click();
    }
    await expect(page.getByText('No projects left.')).toBeVisible();
  });

  test('on a phone-sized screen the panel docks and stays nonmodal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await row(page).getByRole('button').first().click();
    await page.waitForTimeout(800);
    const area = await row(page).boundingBox();
    expect((area?.y ?? 0) + (area?.height ?? 0)).toBeCloseTo(780, 0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row(page).getByLabel('Name')).toBeFocused();
  });
});

test.describe('receipt review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/receipts');
  });

  test('approving a reviewed receipt updates the balance, and undo reverts it', async ({ page }) => {
    await expect(page.getByTestId('balance')).toContainText('You and Sam are even.');
    await page.getByRole('button', { name: /Review Night Train Tickets/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByTestId('balance')).toContainText('Sam owes you $4.75.');
    await expect(page.getByRole('button', { name: /Review Night Train Tickets/ })).toBeFocused();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('balance')).toContainText('You and Sam are even.');
  });

  test('an invalid amount blocks approval and says how to fix it', async ({ page }) => {
    await page.getByRole('button', { name: /Review Harbor Grocer/ }).click();
    await page.getByRole('dialog').getByLabel('Amount in dollars').fill('42,18');
    await expect(page.getByText('Use dollars and cents')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  test('selecting rows brings actions without moving the list, and bulk approval works', async ({ page }) => {
    const list = page.getByTestId('receipt-list');
    const before = await list.boundingBox();
    await page.getByLabel('Select Night Train Tickets').check();
    await page.getByLabel('Select Bright Bakery').check();
    const toolbar = page.getByRole('toolbar', { name: 'Receipt actions' });
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText('2 selected');
    expect(await list.boundingBox()).toEqual(before);
    await toolbar.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByTestId('balance')).toContainText('Sam owes you $11.05.');
  });

  test('moving the timeline shows the balance at that date', async ({ page }) => {
    await page.getByRole('button', { name: /Review Night Train Tickets/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await page.waitForTimeout(800);
    const slider = page.getByRole('slider', { name: 'Balance through the month' });
    await slider.focus();
    await page.keyboard.press('Home');
    await expect(page.getByTestId('balance')).toContainText('even');
  });

  test('a filter with no matches explains itself', async ({ page }) => {
    await page.getByRole('button', { name: /Review Night/ }).focus();
    await page.getByLabel('Filter receipts').click();
    await page.getByRole('option', { name: 'Rejected' }).click();
    await expect(page.getByRole('button', { name: /Review Tide Hardware/ })).toBeVisible();
  });
});
