/**
 * Dashboard E2E Tests
 *
 * Tests for dashboard functionality (requires authentication setup).
 */

import { test, expect } from "@playwright/test";

// These tests require authentication
// In a real scenario, you would use Playwright's authentication state storage
test.describe("Dashboard", () => {
  // Skip auth tests that require a logged-in user
  // These serve as documentation for what should be tested
  test.describe.skip("Authenticated User", () => {
    test.beforeEach(async ({ page }) => {
      // In production, load saved auth state
      // await page.context().addCookies([...]);
      await page.goto("/dashboard");
    });

    test("should display dashboard overview", async ({ page }) => {
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
      await expect(page.getByText(/total calls/i)).toBeVisible();
      await expect(page.getByText(/active flows/i)).toBeVisible();
    });

    test("should display sidebar navigation", async ({ page }) => {
      await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /calls/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /agent canvas/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /phone numbers/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /analytics/i })).toBeVisible();
    });

    test("should navigate to calls page", async ({ page }) => {
      await page.getByRole("link", { name: /calls/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/calls/);
    });

    test("should navigate to canvas page", async ({ page }) => {
      await page.getByRole("link", { name: /agent canvas/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/canvas/);
    });

    test("should navigate to analytics page", async ({ page }) => {
      await page.getByRole("link", { name: /analytics/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/analytics/);
    });
  });
});

// Visual regression tests (run separately)
test.describe("Visual Tests", () => {
  test("login page visual", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("login-page.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  test("signup page visual", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveScreenshot("signup-page.png", {
      maxDiffPixelRatio: 0.1,
    });
  });
});
