import { test, expect } from '@playwright/test';
import { login, clickChannel, waitForChannelReady } from './helpers';

test.describe('Workspace dropdown menu (#31)', () => {
  test('clicking Slawk workspace name opens a dropdown menu', async ({ page }) => {
    await login(page, 'alice@slawk.dev', 'password123');
    await clickChannel(page, 'general');
    await waitForChannelReady(page);

    // Click the workspace name button
    const workspaceBtn = page.getByTestId('workspace-menu-button');
    await expect(workspaceBtn).toBeVisible();
    await workspaceBtn.click();

    // Dropdown should appear
    const dropdown = page.getByTestId('workspace-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 3000 });
  });
});
