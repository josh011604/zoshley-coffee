import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

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
    const storefrontSidebar = page.locator('aside').first();
    const addButtons = storefrontSidebar.getByRole('button', { name: /^Add$/i });
    await expect(addButtons.first()).toBeVisible({ timeout: 15_000 });
    await addButtons.first().click();

    const checkoutButton = page.getByRole('button', { name: /^Checkout$/i });
    await expect(checkoutButton).toBeEnabled();

    // Open checkout
    await checkoutButton.click({ force: true });

    // Fill customer info
    await page.getByLabel('Customer name').fill(customerName);
    await page.getByLabel('Phone').fill('09170000002');
    await page.getByLabel('Fulfillment').selectOption('pickup');
    await page.getByLabel('Payment method').selectOption('Cash on Delivery');

    await expect(page.getByRole('button', { name: /Confirm order/i })).toBeEnabled();

    // Confirm order
    await page.getByRole('button', { name: /Confirm order/i }).click();

    // Expect success modal
    await expect(page.getByText('Order placed')).toBeVisible({ timeout: 10_000 });

    // Open admin and login
    await page.goto(`${BASE}/#/admin`);
    await page.getByRole('button', { name: /Admin/i }).click();
    // pick suggested Jireh
    await page.getByRole('button', { name: /Jireh/i }).click();
    await page.getByLabel('Username or email').fill('jireh');
    await page.getByLabel('Password').fill('jirehPass');
    await page.getByRole('button', { name: /Sign in/i }).click();

    // Expect admin dashboard
    await expect(page.getByRole('heading', { name: 'Coffee Shop Admin Console' })).toBeVisible({ timeout: 10_000 });

    // Go to Orders tab and check recent orders list
    await page.getByRole('button', { name: /Orders/i }).click();
    await expect(page.getByRole('heading', { name: 'Order management' })).toBeVisible();
    await expect(page.getByText(customerName)).toBeVisible({ timeout: 15_000 });
  });

  test('new admin products appear in the storefront menu', async ({ page }) => {
    await page.goto(`${BASE}/#/admin`);
    await page.getByRole('button', { name: /Admin/i }).click();
    await page.getByRole('button', { name: /Jireh/i }).click();
    await page.getByLabel('Username or email').fill('jireh');
    await page.getByLabel('Password').fill('jirehPass');
    await page.getByRole('button', { name: /Sign in/i }).click();

    await expect(page.getByRole('heading', { name: 'Coffee Shop Admin Console' })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Products\/Services/i }).click();
    await page.getByRole('button', { name: /Add new product/i }).click();

    const createdProduct = await page.getByRole('heading', { name: /New Product \d+/ }).first().textContent();
    expect(createdProduct).toMatch(/New Product \d+/);

    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Build your order' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(createdProduct as string)).toBeVisible({ timeout: 15_000 });
  });
});
