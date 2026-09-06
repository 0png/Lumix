export const WHATS_NEW_LAST_SEEN_VERSION_KEY = 'lumix.whatsNew.lastSeenVersion';

export function shouldShowWhatsNew(
  currentVersion: string,
  lastSeenVersion: string | null,
  hasCurrentRelease: boolean
): boolean {
  return hasCurrentRelease && lastSeenVersion !== currentVersion;
}
