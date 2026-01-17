import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdater } from '@/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, RefreshCw } from 'lucide-react';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const { t } = useTranslation();
  const { status, checking, checkForUpdates, downloadUpdate, installUpdate } = useUpdater();

  useEffect(() => {
    if (open && !status.available && !checking) {
      checkForUpdates();
    }
  }, [open, status.available, checking, checkForUpdates]);

  const handleDownload = () => {
    downloadUpdate();
  };

  const handleInstall = () => {
    installUpdate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('updater.title')}</DialogTitle>
          <DialogDescription>
            {checking && t('updater.checking')}
            {!checking && !status.available && !status.error && t('updater.upToDate')}
            {status.error && t('updater.error', { error: status.error })}
            {status.available && !status.downloading && t('updater.available', { version: status.version })}
            {status.downloading && t('updater.downloading')}
          </DialogDescription>
        </DialogHeader>

        {status.downloading && status.progress && (
          <div className="space-y-2">
            <Progress value={status.progress.percent} />
            <p className="text-sm text-muted-foreground text-center">
              {status.progress.percent.toFixed(1)}%
            </p>
          </div>
        )}

        <DialogFooter>
          {checking && (
            <Button disabled>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('updater.checking')}
            </Button>
          )}

          {!checking && !status.available && !status.error && (
            <Button onClick={() => onOpenChange(false)}>
              {t('common.close')}
            </Button>
          )}

          {status.available && !status.downloading && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                {t('updater.download')}
              </Button>
            </>
          )}

          {status.downloading && (
            <Button disabled>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              {t('updater.downloading')}
            </Button>
          )}

          {!status.downloading && status.available && status.progress && status.progress.percent === 100 && (
            <Button onClick={handleInstall}>
              {t('updater.install')}
            </Button>
          )}

          {status.error && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={checkForUpdates}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('updater.retry')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
