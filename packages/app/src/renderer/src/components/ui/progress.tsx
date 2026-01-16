/**
 * Progress 元件 - 進度條
 * 支援多種樣式變體和動畫效果
 * 使用純 CSS 實作，無需額外依賴
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 進度值 (0-100) */
  value?: number;
  /** 樣式變體 */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /** 是否為不確定狀態 */
  indeterminate?: boolean;
}

const variantStyles = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-destructive',
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, variant = 'default', indeterminate = false, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            variantStyles[variant],
            indeterminate && 'animate-progress-indeterminate'
          )}
          style={{
            width: indeterminate ? '50%' : `${clampedValue}%`,
          }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export { Progress };
