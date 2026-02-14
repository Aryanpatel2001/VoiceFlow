/**
 * Authentication E2E Tests
 *
 * Tests for login, signup, and authentication flows.
 */

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.describe("Login Page", () => {
    test("should display login form", async ({ page }) => {
      await page.goto("/login");

      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    });

    test("should show validation errors for empty form", async ({ page }) => {
      await page.goto("/login");

      await page.getByRole("button", { name: /sign in/i }).click();

      // Should show validation errors
      await expect(page.getByText(/email is required/i)).toBeVisible();
    });

    test("should show error for invalid credentials", async ({ page }) => {
      await page.goto("/login");

      await page.getByLabel(/email/i).fill("invalid@example.com");
      await page.getByLabel(/password/i).fill("wrongpassword");
      await page.getByRole("button", { name: /sign in/i }).click();

      // Should show error message
      await expect(page.getByText(/invalid credentials/i)).toBeVisible({ timeout: 10000 });
    });

    test("should have link to signup page", async ({ page }) => {
      await page.goto("/login");

      const signupLink = page.getByRole("link", { name: /sign up/i });
      await expect(signupLink).toBeVisible();
      await signupLink.click();

      await expect(page).toHaveURL(/\/signup/);
    });
  });

  test.describe("Signup Page", () => {
    test("should display signup form", async ({ page }) => {
      await page.goto("/signup");

      await expect(page.getByRole("heading", { name: /create account|sign up/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
    });

    test("should validate email format", async ({ page }) => {
      await page.goto("/signup");

      await page.getByLabel(/email/i).fill("invalid-email");
      await page.getByLabel(/password/i).fill("password123");
      await page.getByRole("button", { name: /sign up|create account/i }).click();

      // Should show validation error
      await expect(page.getByText(/valid email/i)).toBeVisible();
    });

    test("should have link to login page", async ({ page }) => {
      await page.goto("/signup");

      const loginLink = page.getByRole("link", { name: /sign in|log in/i });
      await expect(loginLink).toBeVisible();
      await loginLink.click();

      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect to login when accessing dashboard without auth", async ({ page }) => {
      await page.goto("/dashboard");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect to login when accessing canvas without auth", async ({ page }) => {
      await page.goto("/dashboard/canvas");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
