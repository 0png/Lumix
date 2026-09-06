/**
 * JVM arguments owned by Lumix must never be supplied by a server profile.
 * Keeping this rule in shared code makes renderer validation and main-process
 * validation agree, while the main process remains the final authority.
 */

export function normalizeJvmArguments(args?: readonly string[]): string[] {
  return (args ?? []).map((arg) => arg.trim()).filter(Boolean);
}

export function isLumixManagedJvmArgument(argument: string): boolean {
  const arg = argument.trim();
  return /^-Xms/i.test(arg)
    || /^-Xmx/i.test(arg)
    || /^-jar(?:$|=)/i.test(arg)
    || /^nogui$/i.test(arg)
    || /^--nogui$/i.test(arg)
    || arg.startsWith('@');
}

export function findLumixManagedJvmArgument(args?: readonly string[]): string | undefined {
  return normalizeJvmArguments(args).find(isLumixManagedJvmArgument);
}
