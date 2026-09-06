import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
  title: React.ReactNode;
  description?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

export function WorkspaceDialogHeader({
  title,
  description,
  onBack,
  backLabel,
  className,
  children,
}: WorkspaceDialogHeaderProps) {
  return (
    <div className={cn('shrink-0 border-b bg-background px-5 py-4 sm:px-6', className)}>
      <DialogHeader className="max-w-2xl text-left">
        <div className="flex items-start gap-2.5 pr-8">
          {onBack ? (
            <button
              type="button"
              data-flow-back
              onClick={onBack}
              aria-label={backLabel}
              className="-ml-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[background-color,color,transform] [transition-duration:var(--motion-standard)] [transition-timing-function:var(--ease-interface)] hover:bg-accent hover:text-foreground active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transform-none"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-[15px] font-semibold leading-5 tracking-[-0.01em]">{title}</DialogTitle>
            {description ? (
              <DialogDescription asChild>
                <div className="max-w-xl text-[13px] leading-5 text-muted-foreground">{description}</div>
              </DialogDescription>
            ) : null}
          </div>
        </div>
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
