import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dialogSource = readFileSync(
  resolve(process.cwd(), 'src/renderer/src/components/ui/dialog.tsx'),
  'utf8'
);

describe('dialog hit areas', () => {
  it('keeps modal content and its overlay outside the native titlebar drag region', () => {
    expect((dialogSource.match(/app-no-drag/g) ?? []).length).toBe(2);
  });
});
