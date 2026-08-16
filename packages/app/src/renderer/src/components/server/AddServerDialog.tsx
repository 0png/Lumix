import { ArrowUpRight, Boxes, FolderInput, PackageOpen, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { WorkspaceDialogBody, WorkspaceDialogContent, WorkspaceDialogHeader } from '@/components/ui/workspace-dialog';
import { cn } from '@/lib/utils';

interface AddServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateStandard: () => void;
  onImportModpack: () => void;
  onImportExisting: () => void;
}

const choices = [
  {
    id: 'standard',
    icon: Server,
    accentClass: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
  {
    id: 'modpack',
    icon: PackageOpen,
    accentClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  {
    id: 'existing',
    icon: FolderInput,
    accentClass: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
] as const;

export function AddServerDialog({
  open,
  onOpenChange,
  onCreateStandard,
  onImportModpack,
  onImportExisting,
}: AddServerDialogProps) {
  const { t } = useTranslation();

  const actions = {
    standard: onCreateStandard,
    modpack: onImportModpack,
    existing: onImportExisting,
  };

  const handleChoice = (choice: keyof typeof actions) => {
    onOpenChange(false);
    actions[choice]();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <WorkspaceDialogContent className="w-[calc(100vw-2rem)] sm:max-w-3xl">
        <WorkspaceDialogHeader
          icon={Boxes}
          eyebrow={t('addServerChoice.eyebrow')}
          title={t('addServerChoice.title')}
          description={t('addServerChoice.description')}
        />

        <WorkspaceDialogBody className="grid gap-3 sm:grid-cols-3">
          {choices.map((choice, index) => {
            const Icon = choice.icon;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => handleChoice(choice.id)}
                className="group relative flex min-h-52 flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', choice.accentClass)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground/60">0{index + 1}</span>
                </div>

                <div className="mt-5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold tracking-tight">{t(`addServerChoice.options.${choice.id}.title`)}</h3>
                    {choice.id === 'standard' ? (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                        {t('addServerChoice.recommended')}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm leading-5 text-muted-foreground">
                    {t(`addServerChoice.options.${choice.id}.description`)}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
                  <span>{t(`addServerChoice.options.${choice.id}.action`)}</span>
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </WorkspaceDialogBody>
      </WorkspaceDialogContent>
    </Dialog>
  );
}
