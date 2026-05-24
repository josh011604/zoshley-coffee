import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Admin + ordering smoke', () => {
  test('place order and view admin dashboard', async ({ page }) => {
    const customerName = `E2E Tester ${Date.now()}`;

    // Place an order from storefront
    await page.goto(`${BASE}/`);
    await expect(page.getByRole('heading', { name: 'Build your order' })).toBeVisible({ timeout: 15_000 });

    // Add first available item
    await page.getByRole('button', { name: /Add/i }).first().click();

    // Open checkout
    await page.getByRole('button', { name: /^Checkout$/i }).click({ force: true });

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
});
