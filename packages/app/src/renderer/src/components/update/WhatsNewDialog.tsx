import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUpRight, BookOpen, ChevronRight, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReleaseNoteDto, ReleaseNotesResult } from '../../../../shared/ipc-types';

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ReleaseNotesResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function formatReleaseDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

function ReleaseMarkdown({ release }: { release: ReleaseNoteDto }) {
  const { t } = useTranslation();
  const escapedTitle = release.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markdown = release.body
    .replace(new RegExp(`^#\\s+${escapedTitle}\\s*\\r?\\n+`, 'i'), '')
    .replace(
      /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/gim,
      (_, type: string) => `> **${t(`whatsNew.alerts.${type.toLowerCase()}`)}**`
    );

  return (
    <div className="whats-new-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault();
                if (href) void window.electronAPI.app.openExternal(href);
              }}
            >
              {children}
              <ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden="true" />
            </a>
          ),
          img: () => null,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function LoadingState() {
  return (
    <>
      <aside className="space-y-2 border-r border-border/60 bg-muted/20 p-2.5">
        <Skeleton className="mx-2 mt-1 h-3 w-20" />
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-10 w-full rounded-md" />)}
      </aside>
      <main className="space-y-4 px-8 py-7">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-2/5" />
        <Skeleton className="mt-6 h-px w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    </>
  );
}

export function WhatsNewDialog({ open, onOpenChange, data, loading, error, onRetry }: WhatsNewDialogProps) {
  const { t, i18n } = useTranslation();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !data) return;
    setSelectedTag((current) => {
      if (current && data.releases.some((release) => release.tagName === current)) return current;
      return data.currentRelease?.tagName || data.releases[0]?.tagName || null;
    });
  }, [data, open]);

  const selectedRelease = useMemo(
    () => data?.releases.find((release) => release.tagName === selectedTag) || data?.currentRelease || data?.releases[0] || null,
    [data, selectedTag]
  );

  const openOnGitHub = () => {
    void window.electronAPI.app.openExternal(selectedRelease?.htmlUrl || 'https://github.com/0png/Lumix/releases');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="settings-workspace-modal grid h-[min(620px,90vh)] w-[min(900px,94vw)] max-w-[900px] grid-cols-[168px_minmax(0,1fr)] grid-rows-[56px_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:rounded-xl"
        overlayClassName="settings-workspace-overlay bg-black/55"
      >
        <header className="col-span-2 flex h-14 items-center border-b border-border/60 px-5 pr-14">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-muted/50">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </div>
            <DialogTitle className="text-sm font-semibold tracking-[-0.01em]">{t('whatsNew.title')}</DialogTitle>
            <DialogDescription className="hidden truncate text-xs sm:block">{t('whatsNew.description')}</DialogDescription>
          </div>
        </header>

        {loading && !data ? <LoadingState /> : error && !data ? (
          <main className="col-span-2 flex min-h-0 items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
                <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-sm font-semibold">{t('whatsNew.loadErrorTitle')}</h2>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t('whatsNew.loadErrorDescription')}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry} disabled={loading}>
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                  {t('whatsNew.retry')}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={openOnGitHub}>
                  {t('whatsNew.viewOnGitHub')}<ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </main>
        ) : data && data.releases.length > 0 && selectedRelease ? (
          <>
            <aside className="flex min-h-0 w-[168px] flex-col border-r border-border/60 bg-muted/20 p-2.5">
              <p className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                {t('whatsNew.releaseHistory')}
              </p>
              <nav className="modal-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label={t('whatsNew.releaseHistory')}>
                {data.releases.map((release) => {
                  const isCurrent = release.version === data.currentVersion;
                  const isSelected = release.tagName === selectedRelease.tagName;
                  return (
                    <button
                      key={release.tagName}
                      type="button"
                      onClick={() => setSelectedTag(release.tagName)}
                      className={cn(
                        'whats-new-version flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none',
                        isSelected
                          ? 'bg-accent text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.45)]'
                          : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground'
                      )}
                      aria-current={isSelected ? 'page' : undefined}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">v{release.version}</span>
                          {isCurrent ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/75">
                          {formatReleaseDate(release.publishedAt, i18n.language)}
                        </span>
                      </span>
                      <ChevronRight className={cn('h-3 w-3 shrink-0', isSelected ? 'opacity-60' : 'opacity-0')} aria-hidden="true" />
                    </button>
                  );
                })}
              </nav>
              <Button variant="ghost" size="sm" className="mt-2 h-8 w-full justify-start px-2 text-[11px] text-muted-foreground" onClick={openOnGitHub}>
                <ArrowUpRight className="h-3.5 w-3.5" />{t('whatsNew.viewOnGitHub')}
              </Button>
            </aside>

            <main className="modal-scrollbar min-h-0 min-w-0 overflow-y-auto bg-background">
              <article key={selectedRelease.tagName} className="settings-panel-enter mx-auto max-w-[680px] px-8 py-7">
                {!data.currentRelease ? (
                  <div className="mb-5 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                    {t('whatsNew.currentReleaseMissing', { version: data.currentVersion })}
                  </div>
                ) : null}
                <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-mono tabular-nums">v{selectedRelease.version}</span><span aria-hidden="true">·</span>
                  <span>{formatReleaseDate(selectedRelease.publishedAt, i18n.language)}</span>
                  {selectedRelease.version === data.currentVersion ? <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">{t('whatsNew.currentVersion')}</Badge> : null}
                  {selectedRelease.prerelease ? <Badge variant="outline" className="h-5 px-1.5 text-[9px]">{t('whatsNew.prerelease')}</Badge> : null}
                </div>
                <h1 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{selectedRelease.title}</h1>
                <div className="mt-5 border-t border-border/60 pt-5">
                  {selectedRelease.body ? <ReleaseMarkdown release={selectedRelease} /> : <p className="text-xs text-muted-foreground">{t('whatsNew.emptyRelease')}</p>}
                </div>
              </article>
            </main>
          </>
        ) : (
          <main className="col-span-2 flex min-h-0 items-center justify-center px-8 text-center">
            <div className="max-w-sm">
              <BookOpen className="mx-auto h-5 w-5 text-muted-foreground" />
              <h2 className="mt-3 text-sm font-semibold">{t('whatsNew.emptyTitle')}</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">{t('whatsNew.emptyDescription')}</p>
              <Button variant="outline" size="sm" className="mt-4 h-8 text-xs" onClick={openOnGitHub}>{t('whatsNew.viewOnGitHub')}</Button>
            </div>
          </main>
        )}
      </DialogContent>
    </Dialog>
  );
}
