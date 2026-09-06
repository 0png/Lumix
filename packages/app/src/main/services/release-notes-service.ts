import type { ReleaseNoteDto, ReleaseNotesResult } from '../../shared/ipc-types';
import { fetchJson } from './http-client';

const RELEASES_URL = 'https://api.github.com/repos/0png/Lumix/releases?per_page=10';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  created_at: string;
  draft: boolean;
  prerelease: boolean;
}

export function normalizeReleaseVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

export function mapGitHubRelease(release: GitHubRelease): ReleaseNoteDto {
  return {
    version: normalizeReleaseVersion(release.tag_name),
    tagName: release.tag_name,
    title: release.name?.trim() || release.tag_name,
    publishedAt: release.published_at || release.created_at,
    body: release.body || '',
    htmlUrl: release.html_url,
    prerelease: release.prerelease,
  };
}

export class ReleaseNotesService {
  private cachedReleases: ReleaseNoteDto[] | null = null;
  private cachedAt = 0;
  private pendingRequest: Promise<ReleaseNoteDto[]> | null = null;

  async getReleaseNotes(currentVersion: string): Promise<ReleaseNotesResult> {
    const releases = await this.getReleases();
    const normalizedCurrentVersion = normalizeReleaseVersion(currentVersion);

    return {
      currentVersion: normalizedCurrentVersion,
      currentRelease: releases.find((release) => release.version === normalizedCurrentVersion) || null,
      releases,
    };
  }

  private async getReleases(): Promise<ReleaseNoteDto[]> {
    if (this.cachedReleases && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cachedReleases;
    }

    if (this.pendingRequest) return this.pendingRequest;

    this.pendingRequest = fetchJson<GitHubRelease[]>(RELEASES_URL)
      .then((releases) => {
        if (!Array.isArray(releases)) {
          throw new Error('GitHub returned an invalid releases response');
        }

        const mapped = releases
          .filter((release) => !release.draft)
          .map(mapGitHubRelease)
          .slice(0, 10);

        this.cachedReleases = mapped;
        this.cachedAt = Date.now();
        return mapped;
      })
      .finally(() => {
        this.pendingRequest = null;
      });

    return this.pendingRequest;
  }
}

let releaseNotesService: ReleaseNotesService | null = null;

export function getReleaseNotesService(): ReleaseNotesService {
  if (!releaseNotesService) releaseNotesService = new ReleaseNotesService();
  return releaseNotesService;
}
