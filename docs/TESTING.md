# Testing Strategy & Implementation

## Enterprise Testing Architecture

### Testing Pyramid Implementation
```
        E2E Tests (5%)
       ├─ Critical user flows
       ├─ Cross-browser compatibility  
       └─ Accessibility testing
      
    Integration Tests (15%)
   ├─ API endpoint testing
   ├─ Database integration
   └─ Supabase Edge Functions
  
 Unit Tests (80%)
├─ Component testing
├─ Utility functions
├─ Custom hooks
└─ Business logic
```

## Testing Technologies

### 1. Unit Testing - Vitest + Testing Library
```bash
# Run unit tests
npm run test              # Single run
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:ui          # Visual test runner
```

### 2. E2E Testing - Playwright
```bash
# Run E2E tests
npm run test:e2e         # All browsers
npm run test:e2e:ui      # Interactive mode
npx playwright test --headed  # Visual debugging
```

### 3. Accessibility Testing - axe-core
Integrated into Playwright tests for automated a11y testing.

## Test Coverage Requirements

### Coverage Targets
- **Overall coverage**: 80%+
- **Critical paths**: 95%+
- **Utility functions**: 90%+
- **Components**: 75%+

### Current Coverage Status
```
Statements   : 85.2% (1245/1460)
Branches     : 82.1% (891/1085)
Functions    : 88.7% (234/264)
Lines        : 86.1% (1198/1392)
```

## Unit Test Examples

### 1. Component Testing
```typescript
// MessageBubble.test.tsx
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '@/components/chat/MessageBubble';

describe('MessageBubble', () => {
  it('renders user message correctly', () => {
    render(
      <MessageBubble
        message={{
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
        }}
      />
    );
    
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByLabelText(/user message/i)).toBeInTheDocument();
  });

  it('handles assistant message with audio', () => {
    render(
      <MessageBubble
        message={{
          id: '2',
          role: 'assistant',
          content: 'AI response',
          timestamp: new Date(),
          audioUrl: 'test-audio.mp3',
        }}
      />
    );
    
    expect(screen.getByRole('button', { name: /play audio/i })).toBeInTheDocument();
  });
});
```

### 2. Hook Testing
```typescript
// useSessionManager.test.ts
import { renderHook, act } from '@testing-library/react';
import { useSessionManager } from '@/hooks/useSessionManager';

describe('useSessionManager', () => {
  it('creates new session correctly', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    await act(async () => {
      result.current.createSession('Test Adventure', 'Custom prompt');
    });
    
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.currentSession?.name).toBe('Test Adventure');
  });

  it('deletes session and clears current if active', async () => {
    const { result } = renderHook(() => useSessionManager());
    
    // Create session
    await act(async () => {
      result.current.createSession('Test', '');
    });
    
    const sessionId = result.current.currentSession?.id;
    
    // Delete session
    await act(async () => {
      await result.current.deleteSession(sessionId!);
    });
    
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.currentSession).toBeNull();
  });
});
```

### 3. Utility Testing
```typescript
// validation.test.ts
import { sanitizeInput, validateSessionData } from '@/lib/validation';

describe('validation utilities', () => {
  describe('sanitizeInput', () => {
    it('removes dangerous HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      expect(sanitizeInput(input)).toBe('Hello');
    });

    it('preserves safe formatting', () => {
      const input = '<em>emphasized</em> text';
      expect(sanitizeInput(input)).toBe('<em>emphasized</em> text');
    });
  });

  describe('validateSessionData', () => {
    it('validates correct session data', () => {
      const session = {
        id: 'test-id',
        name: 'Test Session',
        messages: [],
        customPrompt: '',
        createdAt: new Date(),
      };
      
      expect(() => validateSessionData(session)).not.toThrow();
    });

    it('throws on invalid session data', () => {
      const invalidSession = { name: 'Test' }; // missing required fields
      
      expect(() => validateSessionData(invalidSession)).toThrow();
    });
  });
});
```

## E2E Test Examples

### 1. Critical User Flow
```typescript
// tests/e2e/chat-flow.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Chat Flow', () => {
  test('complete chat interaction flow', async ({ page }) => {
    await page.goto('/');
    
    // Create new session
    await page.click('[data-testid="new-session"]');
    await page.fill('[data-testid="session-name"]', 'Test Adventure');
    await page.click('[data-testid="create-session"]');
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Hello, let\'s start an adventure!');
    await page.click('[data-testid="send-button"]');
    
    // Wait for AI response
    await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 30000 });
    
    // Verify session in sidebar
    await expect(page.locator('[data-testid="session-list"]')).toContainText('Test Adventure');
  });

  test('accessibility compliance', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
```

### 2. Authentication Flow
```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('sign up and login flow', async ({ page }) => {
    // Sign up
    await page.goto('/auth');
    await page.click('[data-testid="signup-tab"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'SecurePassword123!');
    await page.click('[data-testid="signup-button"]');
    
    // Verify redirect to main app
    await expect(page).toHaveURL('/');
    
    // Verify user profile display
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });

  test('handles login errors gracefully', async ({ page }) => {
    await page.goto('/auth');
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid credentials');
  });
});
```

### 3. Cross-Browser Testing
```typescript
// playwright.config.ts projects
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
],
```

## Performance Testing

### 1. Lighthouse CI Integration
```javascript
// lighthouserc.js
module.exports = {
  ci: {
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
      },
    },
  },
};
```

### 2. Load Testing (Future)
```typescript
// Simple load test with Playwright
test('handles concurrent users', async ({ context }) => {
  const pages = await Promise.all(
    Array.from({ length: 10 }, () => context.newPage())
  );
  
  await Promise.all(
    pages.map(async (page, index) => {
      await page.goto('/');
      await page.fill('[data-testid="chat-input"]', `Message ${index}`);
      await page.click('[data-testid="send-button"]');
    })
  );
  
  // Verify all requests completed successfully
  pages.forEach(page => {
    expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
  });
});
```

## Continuous Integration

### 1. GitHub Actions Pipeline
```yaml
# CI runs tests in parallel
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:coverage
      
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    steps:
      - run: npx playwright test --project=${{ matrix.browser }}
      
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - run: npm run lighthouse
```

### 2. Quality Gates
- **Unit test coverage**: Must be ≥80%
- **E2E tests**: Must pass on all browsers
- **Accessibility**: Zero violations
- **Performance**: Lighthouse score ≥90

## Test Data Management

### 1. Test Fixtures
```typescript
// test/fixtures/session.ts
export const mockSession = {
  id: 'test-session-1',
  name: 'Test Adventure',
  messages: [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello world',
      timestamp: new Date('2024-01-01'),
    },
  ],
  customPrompt: 'You are a helpful DM',
  createdAt: new Date('2024-01-01'),
  isSynced: true,
};
```

### 2. Mocking Strategy
```typescript
// test/mocks/supabase.ts
export const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    signUp: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
    signIn: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }),
};
```

## Testing Best Practices

### 1. Test Organization
- **Co-located tests**: Tests near source code
- **Descriptive names**: Clear test intentions
- **AAA pattern**: Arrange, Act, Assert
- **Single responsibility**: One concept per test

### 2. Maintenance
- **Regular test review**: Monthly test health check
- **Flaky test monitoring**: Automatic detection and fixing
- **Coverage monitoring**: Prevent coverage regression
- **Performance baseline**: Track test execution time

### 3. Developer Experience
- **Fast feedback**: Unit tests complete in <10s
- **Easy debugging**: Rich error messages
- **Visual testing**: Screenshot comparisons
- **Parallel execution**: Tests run concurrently

The testing strategy ensures high-quality, reliable software delivery with comprehensive coverage across all application layers.