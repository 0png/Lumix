import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowRight, FolderInput, PackageOpen, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { WorkspaceDialogBody, WorkspaceDialogContent, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';
import { cn } from '@/lib/utils';

type AddServerRoute = 'choice' | 'standard' | 'modpack' | 'existing';

export interface EmbeddedServerFlowProps {
  open: boolean;
  active: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToChoice: () => void;
  onCloseBlockedChange: (blocked: boolean) => void;
}

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instantOpen?: boolean;
  renderCreateStandard: (props: EmbeddedServerFlowProps) => ReactNode;
  renderImportModpack: (props: EmbeddedServerFlowProps) => ReactNode;
  renderImportExisting: (props: EmbeddedServerFlowProps) => ReactNode;
}

const choices = [
  { id: 'standard', icon: Server },
  { id: 'modpack', icon: PackageOpen },
  { id: 'existing', icon: FolderInput },
] as const;

const routeWidths: Record<AddServerRoute, string> = {
  choice: 'sm:max-w-[620px]',
  standard: 'sm:max-w-5xl',
  modpack: 'sm:max-w-3xl',
  existing: 'sm:max-w-3xl',
};

export function AddServerDialog({
  open,
  onOpenChange,
  instantOpen = false,
  renderCreateStandard,
  renderImportModpack,
  renderImportExisting,
}: AddServerDialogProps) {
  const { t } = useTranslation();
  const [route, setRoute] = useState<AddServerRoute>('choice');
  const [isSwitching, setIsSwitching] = useState(false);
  const [focusedChoice, setFocusedChoice] = useState(0);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const switchTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const focusRoute = useCallback((nextRoute: AddServerRoute) => {
    window.requestAnimationFrame(() => {
      if (nextRoute === 'choice') {
        choiceRefs.current[focusedChoice]?.focus();
        return;
      }

      const panel = contentRef.current?.querySelector<HTMLElement>(`[data-flow-panel="${nextRoute}"]`);
      const target = panel?.querySelector<HTMLElement>(
        '[data-flow-autofocus], input:not([disabled]), [role="button"][tabindex="0"], button:not([disabled])'
      );
      target?.focus();
    });
  }, [focusedChoice]);

  const changeRoute = useCallback((nextRoute: AddServerRoute, animate: boolean) => {
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduceMotion) {
      setRoute(nextRoute);
      setIsSwitching(false);
      focusRoute(nextRoute);
      return;
    }

    setIsSwitching(true);
    switchTimerRef.current = window.setTimeout(() => {
      setRoute(nextRoute);
      window.requestAnimationFrame(() => {
        setIsSwitching(false);
        focusRoute(nextRoute);
      });
      switchTimerRef.current = null;
    }, 100);
  }, [focusRoute]);

  useEffect(() => () => {
    if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setRoute('choice');
      setIsSwitching(false);
      setFocusedChoice(0);
      setCloseBlocked(false);
      closeTimerRef.current = null;
    }, 180);
  }, [open]);

  const handleChoice = (choice: Exclude<AddServerRoute, 'choice'>, event: MouseEvent<HTMLButtonElement>) => {
    const index = choices.findIndex((item) => item.id === choice);
    setFocusedChoice(index);
    changeRoute(choice, event.detail > 0);
  };

  const handleChoiceKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % choices.length;
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + choices.length) % choices.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = choices.length - 1;
    else return;

    event.preventDefault();
    setFocusedChoice(nextIndex);
    choiceRefs.current[nextIndex]?.focus();
  };

  const closeFlow = (nextOpen: boolean) => {
    if (!nextOpen && closeBlocked) return;
    onOpenChange(nextOpen);
  };
  const backToChoice = () => changeRoute('choice', true);
  const embeddedProps = (target: Exclude<AddServerRoute, 'choice'>): EmbeddedServerFlowProps => ({
    open,
    active: route === target,
    onOpenChange,
    onBackToChoice: backToChoice,
    onCloseBlockedChange: setCloseBlocked,
  });

  return (
    <Dialog open={open} onOpenChange={closeFlow}>
      <WorkspaceDialogContent
        ref={contentRef}
        overlayClassName={instantOpen ? 'data-[state=open]:animate-none' : undefined}
        className={cn(
          'w-[calc(100vw-2rem)] [--tw-enter-scale:.98] [--tw-enter-translate-x:0] [--tw-enter-translate-y:0]',
          instantOpen && 'data-[state=open]:animate-none',
          routeWidths[route]
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusRoute(route);
        }}
        onEscapeKeyDown={(event) => {
          if (closeBlocked) {
            event.preventDefault();
            return;
          }
          if (route !== 'choice') {
            event.preventDefault();
            changeRoute('choice', false);
          }
        }}
      >
        <section
          data-flow-panel="choice"
          hidden={route !== 'choice'}
          className={cn(
            'transition-opacity [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-interface)] motion-reduce:transition-none',
            isSwitching && 'opacity-0'
          )}
        >
          <WorkspaceDialogHeader
            title={t('addServerChoice.title')}
            description={t('addServerChoice.description')}
          />

          <WorkspaceDialogBody className="space-y-2.5">
            <div role="group" aria-label={t('addServerChoice.title')} className="space-y-2.5">
              {choices.map((choice, index) => {
                const Icon = choice.icon;
                return (
                  <button
                    key={choice.id}
                    ref={(node) => {
                      choiceRefs.current[index] = node;
                    }}
                    type="button"
                    onClick={(event) => handleChoice(choice.id, event)}
                    onFocus={() => setFocusedChoice(index)}
                    onKeyDown={(event) => handleChoiceKeyDown(event, index)}
                    className="group flex min-h-[76px] w-full items-center gap-3.5 rounded-xl border border-border/80 bg-card px-4 py-3 text-left shadow-sm transition-[background-color,border-color,box-shadow,transform] [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-interface)] hover:border-foreground/20 hover:bg-accent/45 hover:shadow-md active:scale-[0.985] focus-visible:border-foreground/35 focus-visible:bg-accent/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-[background-color,border-color,box-shadow]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/55 text-foreground shadow-sm transition-[background-color,border-color] [transition-duration:var(--motion-standard)] group-hover:border-foreground/20 group-hover:bg-background">
                      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold tracking-[-0.01em] sm:text-[15px]">
                          {t(`addServerChoice.options.${choice.id}.title`)}
                        </span>
                        {choice.id === 'standard' ? (
                          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                            {t('addServerChoice.recommended')}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground sm:truncate">
                        {t(`addServerChoice.options.${choice.id}.description`)}
                      </span>
                    </span>

                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors [transition-duration:var(--motion-standard)] group-hover:text-foreground" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </WorkspaceDialogBody>
        </section>

        <section
          data-flow-panel="standard"
          hidden={route !== 'standard'}
          className={cn('transition-opacity [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-interface)] motion-reduce:transition-none', isSwitching && 'opacity-0')}
        >
          {renderCreateStandard(embeddedProps('standard'))}
        </section>
        <section
          data-flow-panel="modpack"
          hidden={route !== 'modpack'}
          className={cn('transition-opacity [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-interface)] motion-reduce:transition-none', isSwitching && 'opacity-0')}
        >
          {renderImportModpack(embeddedProps('modpack'))}
        </section>
        <section
          data-flow-panel="existing"
          hidden={route !== 'existing'}
          className={cn('transition-opacity [transition-duration:var(--motion-panel)] [transition-timing-function:var(--ease-interface)] motion-reduce:transition-none', isSwitching && 'opacity-0')}
        >
          {renderImportExisting(embeddedProps('existing'))}
        </section>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
