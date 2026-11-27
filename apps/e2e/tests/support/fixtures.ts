import { expect, test as base } from '@playwright/test';

/**
 * Same `test` as Playwright's, plus a check that the page never hit the Content-Security-Policy set
 * by the nginx front-end images (a violation means a blocked script, style, request or frame).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (
        message.type() === 'error' &&
        /Content Security Policy|Refused to/i.test(message.text())
      ) {
        violations.push(message.text());
      }
    });
    await use(page);
    expect(violations, 'CSP violations').toEqual([]);
  },
});

export { expect };
