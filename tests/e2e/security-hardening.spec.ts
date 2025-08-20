import { test, expect } from '@playwright/test';

test.describe('Security & Demo Mode Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set demo mode for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('demo_mode', 'true');
    });
  });

  test('demo mode blocks AI features', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to chat interface
    await page.click('[data-testid="get-started"]');
    
    // Try to send a message - should show demo mode warning
    await page.fill('[data-testid="message-input"]', 'Test message in demo mode');
    await page.click('[data-testid="send-button"]');
    
    // Should see demo mode notification
    await expect(page.locator('.toast')).toContainText('Demo Mode');
  });

  test('input sanitization works', async ({ page }) => {
    await page.goto('/');
    
    // Try to inject script
    const maliciousInput = '<script>alert("xss")</script>Hello';
    await page.fill('[data-testid="message-input"]', maliciousInput);
    
    // Check that input is sanitized
    const inputValue = await page.inputValue('[data-testid="message-input"]');
    expect(inputValue).not.toContain('<script>');
  });

  test('rate limiting prevents spam', async ({ page }) => {
    await page.goto('/');
    
    // Disable demo mode for this test
    await page.addInitScript(() => {
      window.localStorage.removeItem('demo_mode');
    });
    
    // Try to send multiple messages rapidly
    for (let i = 0; i < 25; i++) {
      await page.fill('[data-testid="message-input"]', `Spam message ${i}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(50);
    }
    
    // Should eventually show rate limit warning
    await expect(page.locator('.toast')).toContainText('Rate limit');
  });

  test('security monitoring detects suspicious activity', async ({ page }) => {
    // Monitor console for security events
    const securityEvents: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('🔒 Security Event:')) {
        securityEvents.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Try to access developer tools (simulated)
    await page.evaluate(() => {
      // Simulate devtools detection
      Object.defineProperty(window, 'outerHeight', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 400 });
    });
    
    await page.waitForTimeout(2000);
    
    // Should detect devtools opening
    expect(securityEvents.some(event => event.includes('devtools_opened'))).toBeTruthy();
  });

  test('mobile UI has proper touch targets', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check button sizes meet accessibility standards (44px minimum)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      
      if (boundingBox) {
        // Touch targets should be at least 44px
        expect(Math.min(boundingBox.width, boundingBox.height)).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('error boundary catches and displays errors gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Inject an error into the page
    await page.evaluate(() => {
      // Force a React error
      const errorEvent = new ErrorEvent('error', {
        error: new Error('Test error for boundary'),
        message: 'Test error for boundary',
      });
      window.dispatchEvent(errorEvent);
    });
    
    // Should show error boundary UI
    await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();
    await expect(page.locator('text=Something went wrong')).toBeVisible();
  });

  test('accessibility standards are met', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper ARIA labels
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute('aria-label');
      const title = await button.getAttribute('title');
      const textContent = await button.textContent();
      
      // Button should have accessible name
      expect(ariaLabel || title || textContent?.trim()).toBeTruthy();
    }
    
    // Check for proper heading structure
    const h1s = await page.locator('h1').count();
    expect(h1s).toBeGreaterThanOrEqual(1);
    
    // Images should have alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const altText = await img.getAttribute('alt');
      expect(altText).toBeTruthy();
    }
  });

  test('performance metrics are within limits', async ({ page }) => {
    const metrics: any[] = [];
    
    page.on('console', (msg) => {
      if (msg.text().includes('LCP:') || msg.text().includes('FID:') || msg.text().includes('CLS:')) {
        metrics.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for performance metrics to be logged
    await page.waitForTimeout(3000);
    
    // Should have performance metrics
    expect(metrics.length).toBeGreaterThan(0);
    
    // Check if metrics are within reasonable bounds (basic check)
    const lcpMetric = metrics.find(m => m.includes('LCP:'));
    if (lcpMetric) {
      const lcpValue = parseInt(lcpMetric.match(/\d+/)?.[0] || '0');
      expect(lcpValue).toBeLessThan(4000); // LCP should be under 4s
    }
  });
});