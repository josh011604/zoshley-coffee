import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const seedAdminSession = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'zoshley-demo-staff-session',
      JSON.stringify({ email: 'jireh@zoshleycoffee.com', name: 'Jireh', role: 'admin' }),
    );
  });
};

test.describe('Admin + ordering smoke', () => {
  test('place order and view admin dashboard', async ({ page }) => {
    const customerName = `E2E Tester ${Date.now()}`;

    // Place an order from storefront
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Build your order' })).toBeVisible({ timeout: 15_000 });

    const dismissWhatsNew = page.getByRole('button', { name: /Dismiss/i });
    if (await dismissWhatsNew.isVisible().catch(() => false)) {
      await dismissWhatsNew.click();
    }

    // Add first available item
    await page.getByRole('button', { name: /^Add$/i }).first().click({ force: true });

    const checkoutButton = page.getByRole('button', { name: /^Checkout$/i });
    await expect(checkoutButton).toBeEnabled();

    // Open checkout
    await checkoutButton.click({ force: true });

    // Fill customer info
    await page.getByLabel('Customer name').fill(customerName);
    await page.getByLabel('Phone').fill('09170000002');
    await page.getByLabel('Fulfillment').selectOption('pickup');
    await page.getByLabel('Payment method').selectOption('Cash on Delivery');

    const confirmOrderButton = page.getByRole('button', { name: /Confirm order/i });
    await expect(confirmOrderButton).toBeEnabled({ timeout: 15_000 });

    // Confirm order
    await confirmOrderButton.click({ force: true });

    // Expect success modal
    await expect(page.getByText('Order placed')).toBeVisible({ timeout: 10_000 });
  });

  test('new admin products appear in the storefront menu', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto(`${BASE}/#/admin`);

    await expect(page.getByRole('heading', { name: 'Coffee Shop Admin Console' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Products\/Services/i }).click();
    await page.getByRole('button', { name: /Add new product/i }).click();

    const createdProduct = await page.getByRole('heading', { name: /New Product \d+/ }).first().textContent();
    expect(createdProduct).toMatch(/New Product \d+/);

    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Build your order' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(createdProduct as string)).toBeVisible({ timeout: 15_000 });
  });

  test('new admin categories and inventory persist after reload', async ({ page }) => {
    await seedAdminSession(page);
    await page.goto(`${BASE}/#/admin`);

    await expect(page.getByRole('heading', { name: 'Coffee Shop Admin Console' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Categories/i }).click();
    await page.getByRole('button', { name: /Add category/i }).click();
    const categoryName = await page.getByRole('heading', { name: /New Category \d+/ }).first().textContent();
    expect(categoryName).toMatch(/New Category \d+/);

    await page.goto(`${BASE}/`);
    await expect(page.getByRole('button', { name: categoryName as string })).toBeVisible({ timeout: 15_000 });

    await seedAdminSession(page);
    await page.goto(`${BASE}/#/admin`);
    await page.getByRole('button', { name: /Inventory/i }).click();
    await page.getByRole('button', { name: /Add stock log/i }).click();

    const inventoryItem = await page.getByLabel(/Edit name for New Inventory Item \d+/).first().inputValue();
    await expect(page.getByLabel(`Edit name for ${inventoryItem}`)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Inventory/i }).click();
    await expect(page.getByLabel(`Edit name for ${inventoryItem}`)).toBeVisible({ timeout: 10_000 });
  });
});
