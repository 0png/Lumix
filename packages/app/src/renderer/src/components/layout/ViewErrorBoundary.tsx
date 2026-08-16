import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ViewErrorBoundaryProps {
  children: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onReset: () => void;
}

interface ViewErrorBoundaryState {
  error: Error | null;
}

/**
 * 隔離單一主視圖的 render 錯誤，避免例外一路卸載整個 renderer root。
 * 切換視圖時由父層 key 重新建立 boundary 並清除錯誤狀態。
 */
export class ViewErrorBoundary extends Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ViewErrorBoundary] Failed to render the active view', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[320px] items-center justify-center px-6 py-12">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-base font-semibold">{this.props.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {this.props.description}
          </p>
          <Button className="mt-5" size="sm" onClick={this.handleReset}>
            {this.props.actionLabel}
          </Button>
        </div>
      </div>
    );
  }
}
