import { test, expect, Page } from '@playwright/test';

test.describe('Room Join & Sync Flow', () => {
  // Helper to create a test user and session
  const setupTestSession = async (page: Page) => {
    // Navigate to app and sign up
    await page.goto('/auth');
    
    const email = `test-${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for redirect to main page
    await page.waitForURL('/');
    
    return { email, password };
  };

  test('Two users can join the same session and see each other in presence', async ({ browser }) => {
    // Create two browser contexts for two users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup first user
      const user1 = await setupTestSession(page1);
      
      // Create a multiplayer session
      await page1.click('[data-testid="create-session"]');
      await page1.fill('input[placeholder*="session name"]', 'Test Multiplayer Session');
      await page1.check('input[type="checkbox"][aria-label*="multiplayer"]');
      await page1.click('button[type="submit"]');
      
      // Get the session URL
      const sessionUrl = page1.url();
      const sessionId = sessionUrl.split('/').pop();

      // Setup second user
      const user2 = await setupTestSession(page2);
      
      // Navigate to the same session URL
      const canonicalUrl = `/table/${sessionId}`;
      await page2.goto(canonicalUrl);
      
      // Both users should see the same session
      await expect(page1.locator('[data-testid="session-name"]')).toContainText('Test Multiplayer Session');
      await expect(page2.locator('[data-testid="session-name"]')).toContainText('Test Multiplayer Session');
      
      // Both users should see each other in participants list
      await expect(page1.locator('[data-testid="participants-list"]')).toBeVisible();
      await expect(page2.locator('[data-testid="participants-list"]')).toBeVisible();
      
      // Check presence indicators
      await expect(page1.locator('[data-testid="online-indicator"]')).toHaveCount(2); // Both users online
      await expect(page2.locator('[data-testid="online-indicator"]')).toHaveCount(2); // Both users online
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Message sent by User A is received by User B within 1500ms', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup both users in the same session
      await setupTestSession(page1);
      await setupTestSession(page2);
      
      // Create session and join both users (simplified for test)
      await page1.click('[data-testid="create-session"]');
      await page1.fill('input[placeholder*="session name"]', 'Message Test Session');
      await page1.check('input[type="checkbox"][aria-label*="multiplayer"]');
      await page1.click('button[type="submit"]');
      
      const sessionUrl = page1.url();
      const sessionId = sessionUrl.split('/').pop();
      await page2.goto(`/table/${sessionId}`);
      
      // User A sends a message
      const messageText = `Test message ${Date.now()}`;
      const startTime = Date.now();
      
      await page1.fill('[data-testid="message-input"]', messageText);
      await page1.press('[data-testid="message-input"]', 'Enter');
      
      // User B should receive the message within 1500ms
      await page2.waitForSelector(`text="${messageText}"`, { timeout: 1500 });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      expect(latency).toBeLessThan(1500);
      console.log(`Message received in ${latency}ms`);
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Page refresh maintains session history and reconnects', async ({ page }) => {
    await setupTestSession(page);
    
    // Create session and send some messages
    await page.click('[data-testid="create-session"]');
    await page.fill('input[placeholder*="session name"]', 'Refresh Test Session');
    await page.click('button[type="submit"]');
    
    const message1 = 'Message before refresh';
    const message2 = 'Another message';
    
    await page.fill('[data-testid="message-input"]', message1);
    await page.press('[data-testid="message-input"]', 'Enter');
    
    await page.fill('[data-testid="message-input"]', message2);
    await page.press('[data-testid="message-input"]', 'Enter');
    
    // Wait for messages to appear
    await page.waitForSelector(`text="${message1}"`);
    await page.waitForSelector(`text="${message2}"`);
    
    // Refresh the page
    await page.reload();
    
    // History should be maintained
    await expect(page.locator(`text="${message1}"`)).toBeVisible();
    await expect(page.locator(`text="${message2}"`)).toBeVisible();
    
    // Session should be reconnected (check for connection status)
    await expect(page.locator('[data-testid="connection-status"]')).toHaveClass(/connected/);
  });

  test('Private session rejects non-member with 403', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1 creates private session
      await setupTestSession(page1);
      
      await page1.click('[data-testid="create-session"]');
      await page1.fill('input[placeholder*="session name"]', 'Private Session');
      // Don't check multiplayer - keep it private
      await page1.click('button[type="submit"]');
      
      const sessionUrl = page1.url();
      const sessionId = sessionUrl.split('/').pop();
      
      // User 2 tries to access private session
      await setupTestSession(page2);
      await page2.goto(`/table/${sessionId}`);
      
      // Should see access denied message
      await expect(page2.locator('text="Access denied"')).toBeVisible();
      // Or should be redirected to 403 page
      await expect(page2.locator('text="Forbidden"')).toBeVisible();
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Typing indicators work correctly', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Setup both users in same session
      await setupTestSession(page1);
      await setupTestSession(page2);
      
      await page1.click('[data-testid="create-session"]');
      await page1.check('input[type="checkbox"][aria-label*="multiplayer"]');
      await page1.click('button[type="submit"]');
      
      const sessionUrl = page1.url();
      const sessionId = sessionUrl.split('/').pop();
      await page2.goto(`/table/${sessionId}`);
      
      // User A starts typing
      await page1.focus('[data-testid="message-input"]');
      await page1.type('[data-testid="message-input"]', 'T');
      
      // User B should see typing indicator
      await page2.waitForSelector('[data-testid="typing-indicator"]', { timeout: 2000 });
      await expect(page2.locator('[data-testid="typing-indicator"]')).toContainText('is typing');
      
      // User A stops typing
      await page1.press('[data-testid="message-input"]', 'Backspace');
      
      // Typing indicator should disappear after timeout
      await page2.waitForSelector('[data-testid="typing-indicator"]', { state: 'hidden', timeout: 5000 });
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('Demo mode guards work correctly', async ({ page }) => {
    // Enable demo mode
    await page.addInitScript(() => {
      localStorage.setItem('demo-mode', 'true');
    });
    
    await page.goto('/');
    
    // Should be able to join session in demo mode
    await page.click('[data-testid="demo-session"]');
    await expect(page.locator('[data-testid="session-container"]')).toBeVisible();
    
    // But message sending should be disabled
    await page.fill('[data-testid="message-input"]', 'Test message in demo');
    await page.press('[data-testid="message-input"]', 'Enter');
    
    // Should see demo mode warning
    await expect(page.locator('text*="Demo mode"')).toBeVisible();
    await expect(page.locator('text*="message not sent"')).toBeVisible();
  });
});
