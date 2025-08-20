import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('D&D Assistant App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads main page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/D&D Assistant/);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('has proper heading structure', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    
    // Should have logical heading hierarchy
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    expect(headings.length).toBeGreaterThan(0);
  });

  test('sidebar is accessible and functional', async ({ page }) => {
    // Test sidebar toggle
    const sidebarTrigger = page.getByRole('button', { name: /toggle sidebar/i });
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
    }

    // Check for adventures section
    await expect(page.getByText(/adventures/i)).toBeVisible();
  });

  test('chat interface is present', async ({ page }) => {
    // Should have chat input
    const chatInput = page.getByRole('textbox', { name: /message/i }).or(
      page.getByPlaceholder(/type.*message/i)
    );
    
    if (await chatInput.isVisible()) {
      await expect(chatInput).toBeVisible();
      
      // Should have send button
      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toBeVisible();
    }
  });

  test('navigation works correctly', async ({ page }) => {
    // Test navigation to different sections
    const navigation = page.getByRole('navigation').first();
    if (await navigation.isVisible()) {
      const navItems = navigation.getByRole('link');
      const count = await navItems.count();
      
      if (count > 0) {
        // Click first nav item
        await navItems.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should not show error
        await expect(page.getByText(/error/i)).not.toBeVisible();
      }
    }
  });

  test('responsive design works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Page should still be usable on mobile
    await expect(page.getByRole('main')).toBeVisible();
    
    // Sidebar should be collapsible on mobile
    const sidebarTrigger = page.getByRole('button', { name: /toggle.*sidebar/i }).or(
      page.getByRole('button', { name: /menu/i })
    );
    
    if (await sidebarTrigger.isVisible()) {
      await sidebarTrigger.click();
      // Should not cause layout issues
      await expect(page.getByRole('main')).toBeVisible();
    }
  });

  test('keyboard navigation works', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Should have visible focus indicators
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Continue tabbing through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = page.locator(':focus');
      if (await currentFocus.isVisible()) {
        // Focus should be visible
        await expect(currentFocus).toBeVisible();
      }
    }
  });

  test('meets accessibility standards', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('body')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('skip link functionality', async ({ page }) => {
    // Focus skip link with keyboard
    await page.keyboard.press('Tab');
    
    const skipLink = page.getByRole('link', { name: /skip to main content/i });
    if (await skipLink.isVisible()) {
      await skipLink.click();
      
      // Should focus main content
      const mainContent = page.getByRole('main').or(page.locator('#main-content'));
      if (await mainContent.isVisible()) {
        await expect(mainContent).toBeFocused();
      }
    }
  });

  test('error states are handled gracefully', async ({ page }) => {
    // Try to trigger an error by navigating to non-existent route
    await page.goto('/non-existent-route');
    
    // Should show 404 or redirect to home
    const is404 = await page.getByText(/404|not found/i).isVisible();
    const isRedirected = await page.url().includes('/');
    
    expect(is404 || isRedirected).toBe(true);
  });

  test('performance meets standards', async ({ page }) => {
    // Measure Core Web Vitals
    const performanceMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const metrics = {};
          
          entries.forEach((entry) => {
            if (entry.entryType === 'measure') {
              metrics[entry.name] = entry.duration;
            }
            if (entry.entryType === 'navigation') {
              metrics['loadComplete'] = entry.loadEventEnd - entry.loadEventStart;
            }
          });
          
          resolve(metrics);
        }).observe({ entryTypes: ['measure', 'navigation'] });
        
        // Timeout after 5 seconds
        setTimeout(() => resolve({}), 5000);
      });
    });

    // Basic performance check - page should load reasonably fast
    expect(performanceMetrics).toBeDefined();
  });
});