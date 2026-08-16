import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WorkspaceDialogTone = 'primary' | 'emerald' | 'amber' | 'destructive';

const toneStyles: Record<WorkspaceDialogTone, { text: string; icon: string; glow: string }> = {
  primary: {
    text: 'text-primary',
    icon: 'border-primary/20 bg-primary/10 text-primary',
    glow: 'bg-primary/[0.05]',
  },
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-300',
    icon: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    glow: 'bg-emerald-500/[0.05]',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-300',
    icon: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    glow: 'bg-amber-500/[0.05]',
  },
  destructive: {
    text: 'text-destructive',
    icon: 'border-destructive/25 bg-destructive/10 text-destructive',
    glow: 'bg-destructive/[0.05]',
  },
};

export const WorkspaceDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn('max-h-[94vh] gap-0 overflow-hidden p-0', className)}
    {...props}
  />
));
WorkspaceDialogContent.displayName = 'WorkspaceDialogContent';

interface WorkspaceDialogHeaderProps {
  icon: LucideIcon;
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  tone?: WorkspaceDialogTone;
  className?: string;
  children?: React.ReactNode;
}

export function WorkspaceDialogHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone = 'primary',
  className,
  children,
}: WorkspaceDialogHeaderProps) {
  const styles = toneStyles[tone];
  return (
    <div className={cn('relative shrink-0 overflow-hidden border-b bg-gradient-to-br from-primary/[0.07] via-background to-background px-6 py-5', className)}>
      <div className={cn('pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full border border-current/10', styles.glow)} />
      <div className="pointer-events-none absolute right-16 top-8 h-11 w-11 rotate-12 rounded-xl border border-current/10" />
      <DialogHeader className="relative max-w-2xl text-left">
        <div className={cn('mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]', styles.text)}>
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', styles.icon)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          {eyebrow}
        </div>
        <DialogTitle className="text-xl leading-tight sm:text-2xl">{title}</DialogTitle>
        {description ? (
          <DialogDescription asChild>
            <div className="max-w-xl text-sm leading-5 text-muted-foreground">{description}</div>
          </DialogDescription>
        ) : null}
        {children}
      </DialogHeader>
    </div>
  );
}

export function WorkspaceDialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-6 py-5', className)} {...props} />;
}

export function WorkspaceDialogFooter({ className, ...props }: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn('m-0 shrink-0 gap-2 border-t bg-muted/[0.18] px-6 py-4 sm:space-x-0', className)}
      {...props}
    />
  );
}
