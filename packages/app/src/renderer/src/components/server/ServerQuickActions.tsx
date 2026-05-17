import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  id: string;
  stepNumber: number;
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
}

interface ServerQuickActionsProps {
  actions: QuickAction[];
}

export function ServerQuickActions({ actions }: ServerQuickActionsProps) {
  return (
    <div className="grid gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="outline"
          className="h-auto items-start justify-start gap-3 p-3 text-left"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          <span className="mt-0.5 shrink-0">{action.icon}</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Step {action.stepNumber}
            </span>
            <span className="block text-sm font-medium">{action.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{action.description}</span>
          </span>
        </Button>
      ))}
    </div>
  );
}
