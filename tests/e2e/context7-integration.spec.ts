/**
 * @fileoverview E2E tests for Context7 integration
 */

import { test, expect } from '@playwright/test';

test.describe('Context7 Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show Context7 suggestion when technical terms are detected', async ({ page }) => {
    // Navigate to a chat interface (assuming main page has chat)
    const messageInput = page.getByTestId('message-input');
    
    // Type a message with technical terms
    await messageInput.fill('I need help with React components and TypeScript interfaces');
    
    // Check if Context7 suggestion appears
    const context7Button = page.getByRole('button', { name: /open latest docs \(context7\)/i });
    await expect(context7Button).toBeVisible();
    
    // Verify the detected technologies are shown
    const detectedTechs = page.getByText(/detected: react, typescript/i);
    await expect(detectedTechs).toBeVisible();
  });

  test('should not show Context7 suggestion for non-technical messages', async ({ page }) => {
    const messageInput = page.getByTestId('message-input');
    
    // Type a non-technical message
    await messageInput.fill('Hello, how are you today?');
    
    // Context7 button should not be visible
    const context7Button = page.getByRole('button', { name: /open latest docs \(context7\)/i });
    await expect(context7Button).not.toBeVisible();
  });

  test('should open Context7 in new tab when button is clicked', async ({ page, context }) => {
    const messageInput = page.getByTestId('message-input');
    
    // Type a technical message
    await messageInput.fill('React hooks and state management issues');
    
    // Wait for Context7 button to appear
    const context7Button = page.getByRole('button', { name: /open latest docs \(context7\)/i });
    await expect(context7Button).toBeVisible();
    
    // Set up listener for new page
    const pagePromise = context.waitForEvent('page');
    
    // Click the Context7 button
    await context7Button.click();
    
    // Wait for new page and verify URL
    const newPage = await pagePromise;
    await expect(newPage.url()).toContain('context7.com');
    await expect(newPage.url()).toContain('q=');
  });

  test('should allow disabling Context7 suggestions in settings', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');
    
    // Click on the docs tab
    await page.getByRole('tab', { name: /docs/i }).click();
    
    // Find and disable Context7 toggle
    const context7Toggle = page.getByRole('switch', { name: /context7 documentation suggestions/i });
    await expect(context7Toggle).toBeVisible();
    await expect(context7Toggle).toBeChecked();
    
    // Disable it
    await context7Toggle.click();
    await expect(context7Toggle).not.toBeChecked();
    
    // Navigate back to main page
    await page.goto('/');
    
    // Type technical message
    const messageInput = page.getByTestId('message-input');
    await messageInput.fill('React components and TypeScript');
    
    // Context7 button should not appear
    const context7Button = page.getByRole('button', { name: /open latest docs \(context7\)/i });
    await expect(context7Button).not.toBeVisible();
  });

  test('should persist Context7 settings across page reloads', async ({ page }) => {
    // Navigate to settings and disable Context7
    await page.goto('/settings');
    await page.getByRole('tab', { name: /docs/i }).click();
    
    const context7Toggle = page.getByRole('switch', { name: /context7 documentation suggestions/i });
    await context7Toggle.click();
    
    // Reload the page
    await page.reload();
    await page.getByRole('tab', { name: /docs/i }).click();
    
    // Setting should still be disabled
    await expect(context7Toggle).not.toBeChecked();
  });

  test('should show Context7 information in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('tab', { name: /docs/i }).click();
    
    // Check for Context7 information
    await expect(page.getByText(/how context7 works/i)).toBeVisible();
    await expect(page.getByText(/automatically detects technical terms/i)).toBeVisible();
    
    // Check for external links
    const visitContext7Button = page.getByRole('button', { name: /visit context7/i });
    await expect(visitContext7Button).toBeVisible();
    
    const integrationGuideButton = page.getByRole('button', { name: /view integration guide/i });
    await expect(integrationGuideButton).toBeVisible();
  });

  test('should handle security in Context7 URL generation', async ({ page }) => {
    const messageInput = page.getByTestId('message-input');
    
    // Try to inject malicious content
    await messageInput.fill('React <script>alert("xss")</script> components');
    
    const context7Button = page.getByRole('button', { name: /open latest docs \(context7\)/i });
    
    if (await context7Button.isVisible()) {
      const pagePromise = page.context().waitForEvent('page');
      await context7Button.click();
      
      const newPage = await pagePromise;
      const url = newPage.url();
      
      // Verify the URL is properly encoded and doesn't contain script tags
      expect(url).not.toContain('<script>');
      expect(url).not.toContain('alert');
      expect(url).toContain('%3C'); // Should be URL encoded
    }
  });
});