import { describe, expect, it } from 'vitest';
import { shouldShowWhatsNew } from '../src/renderer/src/lib/whats-new';

describe('What\'s New visibility', () => {
  it('shows on a fresh install when the current release exists', () => {
    expect(shouldShowWhatsNew('1.1.1', null, true)).toBe(true);
  });

  it('does not reopen a release that has already been seen', () => {
    expect(shouldShowWhatsNew('1.1.1', '1.1.1', true)).toBe(false);
  });

  it('shows again after the application version changes', () => {
    expect(shouldShowWhatsNew('1.2.0', '1.1.1', true)).toBe(true);
  });

  it('does not open or mark a missing current release', () => {
    expect(shouldShowWhatsNew('1.2.0', null, false)).toBe(false);
  });
});
