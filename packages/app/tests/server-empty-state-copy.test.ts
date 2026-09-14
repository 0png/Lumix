import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import en from '../src/renderer/src/i18n/locales/en.json';
import zhTW from '../src/renderer/src/i18n/locales/zh-TW.json';

const requiredEmptyStateKeys = ['emptyEyebrow', 'emptyTitle', 'emptyDescription'] as const;
const serverListSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/components/server/ServerList.tsx'),
  'utf8'
);

describe('server dashboard empty state copy', () => {
  it('provides the compact empty state copy in every supported locale', () => {
    for (const locale of [zhTW, en]) {
      for (const key of requiredEmptyStateKeys) {
        expect(locale.dashboard[key]).toEqual(expect.any(String));
        expect(locale.dashboard[key].trim()).not.toBe('');
      }

      expect(locale.dashboard.emptyBadge).toBeUndefined();
      expect(locale.dashboard.emptySteps).toBeUndefined();
    }
  });

  it('fills the available content height at both compact and fullscreen widths', () => {
    expect(serverListSource).toContain('min-h-[calc(100vh-8rem)]');
    expect(serverListSource).toContain('lg:min-h-[calc(100vh-9rem)]');
    expect(serverListSource).not.toContain('min-h-[min(560px,calc(100vh-8rem))]');
  });
});
