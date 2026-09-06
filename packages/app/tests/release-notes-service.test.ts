import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from '../src/main/services/http-client';
import {
  mapGitHubRelease,
  normalizeReleaseVersion,
  ReleaseNotesService,
} from '../src/main/services/release-notes-service';

vi.mock('../src/main/services/http-client', () => ({
  fetchJson: vi.fn(),
}));

function githubRelease(overrides: Record<string, unknown> = {}) {
  return {
    tag_name: 'v1.1.1',
    name: 'Lumix 1.1.1',
    body: '## Fixed\n- A packaged-app issue',
    html_url: 'https://github.com/0png/Lumix/releases/tag/v1.1.1',
    published_at: '2026-08-16T12:58:00Z',
    created_at: '2026-08-16T12:00:00Z',
    draft: false,
    prerelease: false,
    ...overrides,
  };
}

describe('ReleaseNotesService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes v-prefixed release tags', () => {
    expect(normalizeReleaseVersion('v1.1.1')).toBe('1.1.1');
    expect(normalizeReleaseVersion(' V0.1.0-beta ')).toBe('0.1.0-beta');
  });

  it('maps GitHub fields and falls back to the tag and creation date', () => {
    expect(mapGitHubRelease(githubRelease({ name: null, body: null, published_at: null }))).toEqual({
      version: '1.1.1',
      tagName: 'v1.1.1',
      title: 'v1.1.1',
      publishedAt: '2026-08-16T12:00:00Z',
      body: '',
      htmlUrl: 'https://github.com/0png/Lumix/releases/tag/v1.1.1',
      prerelease: false,
    });
  });

  it('filters drafts, preserves prereleases, and selects the exact current version', async () => {
    vi.mocked(fetchJson).mockResolvedValue([
      githubRelease(),
      githubRelease({ tag_name: 'v1.1.0', name: 'Lumix 1.1.0', prerelease: true }),
      githubRelease({ tag_name: 'v1.2.0', draft: true }),
    ] as never);

    const result = await new ReleaseNotesService().getReleaseNotes('1.1.0');

    expect(result.releases.map((release) => release.version)).toEqual(['1.1.1', '1.1.0']);
    expect(result.currentRelease?.version).toBe('1.1.0');
    expect(result.currentRelease?.prerelease).toBe(true);
  });

  it('does not substitute the newest release when the current tag is absent', async () => {
    vi.mocked(fetchJson).mockResolvedValue([githubRelease()] as never);

    const result = await new ReleaseNotesService().getReleaseNotes('2.0.0');

    expect(result.currentRelease).toBeNull();
    expect(result.releases).toHaveLength(1);
  });

  it('reuses a recent successful GitHub response', async () => {
    vi.mocked(fetchJson).mockResolvedValue([githubRelease()] as never);
    const service = new ReleaseNotesService();

    await service.getReleaseNotes('1.1.1');
    await service.getReleaseNotes('1.1.1');

    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('surfaces GitHub failures so the UI can retry', async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error('HTTP_ERROR: 403'));
    await expect(new ReleaseNotesService().getReleaseNotes('1.1.1')).rejects.toThrow('HTTP_ERROR: 403');
  });
});
