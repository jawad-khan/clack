import { test, expect } from '@playwright/test';
import { login, register, uniqueEmail, clickChannel } from './helpers';

test.describe('URL-based channel navigation', () => {
  test('clicking a channel updates the URL', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, 'URL Tester', email, 'password123');
    await expect(page.getByTestId('sidebar')).toBeVisible();

    // Click the #engineering channel (join it first via API if needed)
    // First join all channels
    await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/channels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const channels = await res.json();
      for (const ch of channels) {
        await fetch(`/channels/${ch.id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      }
    });
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });

    // Click on #general channel and verify URL
    await clickChannel(page, 'general');
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 5_000 });

    // URL should now contain /channels/<id>
    await expect(page).toHaveURL(/\/c\/\d+/, { timeout: 5_000 });

    // Record the channel ID from the URL for general
    const generalUrl = page.url();
    expect(generalUrl).toMatch(/\/c\/\d+/);

    // Click on #engineering channel
    await clickChannel(page, 'engineering');
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 5_000 });

    // URL should update to a different /channels/<id>
    const engineeringUrl = page.url();
    await expect(page).toHaveURL(/\/c\/\d+/, { timeout: 5_000 });
    expect(engineeringUrl).not.toBe(generalUrl);
  });

  test('page refresh preserves the active channel', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, 'Refresh Tester', email, 'password123');
    await expect(page.getByTestId('sidebar')).toBeVisible();

    // Join all channels so #engineering is available
    await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/channels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const channels = await res.json();
      for (const ch of channels) {
        await fetch(`/channels/${ch.id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      }
    });
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });

    // Navigate to #engineering
    await clickChannel(page, 'engineering');
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 5_000 });

    // Capture the URL and verify it's /channels/<id>
    const urlBeforeRefresh = page.url();
    expect(urlBeforeRefresh).toMatch(/\/c\/\d+/);

    // Refresh the page
    await page.reload();
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 10_000 });

    // URL should still be the same channel
    expect(page.url()).toBe(urlBeforeRefresh);

    // The message input should reference #engineering
    await expect(page.locator('.ql-editor')).toHaveAttribute(
      'data-placeholder',
      'Message #engineering',
      { timeout: 5_000 }
    );
  });

  test('default route / redirects to a channel URL', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, 'Default Redirect Tester', email, 'password123');
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });

    // After login/register, URL should NOT be just /
    await expect(page).toHaveURL(/\/c\/\d+/, { timeout: 5_000 });
  });

  test('navigating to a channel URL directly loads that channel', async ({ page }) => {
    const email = uniqueEmail();
    await register(page, 'Direct URL Tester', email, 'password123');
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });

    // Get the channel ID for #general via API
    const generalChannelId = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/channels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const channels = await res.json();
      const general = channels.find((c: { name: string }) => c.name === 'general');
      return general?.id ?? null;
    });

    expect(generalChannelId).not.toBeNull();

    // Navigate directly to /c/<generalId>
    await page.goto(`/c/${generalChannelId}`);
    await expect(page.getByTestId('sidebar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ql-editor')).toBeVisible({ timeout: 5_000 });

    // Should show #general
    await expect(page.locator('.ql-editor')).toHaveAttribute(
      'data-placeholder',
      'Message #general',
      { timeout: 5_000 }
    );
  });
});
