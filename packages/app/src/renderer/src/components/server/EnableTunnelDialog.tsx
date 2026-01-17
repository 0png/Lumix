/**
 * EnableTunnelDialog 元件
 * 當服務器成功啟動後，詢問用戶是否啟用 Playit 隧道
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface EnableTunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  onEnable: (serverId: string, dontAskAgain: boolean) => Promise<void>;
}

export function EnableTunnelDialog({
  open,
  onOpenChange,
  serverId,
  onEnable,
}: EnableTunnelDialogProps) {
  const { t } = useTranslation();
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await onEnable(serverId, dontAskAgain);
      onOpenChange(false);
      setDontAskAgain(false);
    } catch (error) {
      toast.error(t('toast.error', '發生錯誤'));
      console.error('Failed to enable tunnel:', error);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setDontAskAgain(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('tunnel.enableTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('tunnel.enableDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="dontAskAgain"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor="dontAskAgain"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {t('tunnel.dontAskAgain')}
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isEnabling}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleEnable} disabled={isEnabling}>
            {isEnabling ? t('tunnel.enabling') : t('tunnel.enable')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
