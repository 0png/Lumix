/**
 * TunnelClaimDialog 元件
 * 當 Playit 隧道需要 claim 時，顯示對話框引導用戶完成設定
 */

import { useState } from 'react';
import { ExternalLink, Globe, Copy, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface TunnelClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claimUrl: string;
  claimCode: string;
  serverId: string;
  onSaveIp?: (serverId: string, ip: string) => void;
}

export function TunnelClaimDialog({
  open,
  onOpenChange,
  claimUrl,
  claimCode,
  serverId,
  onSaveIp,
}: TunnelClaimDialogProps) {
  const { t } = useTranslation();
  const [showIpInput, setShowIpInput] = useState(false);
  const [playitIp, setPlayitIp] = useState('');

  const handleOpenUrl = async () => {
    try {
      await window.electronAPI.app.openExternal(claimUrl);
      // 開啟網頁後，顯示 IP 輸入框
      setShowIpInput(true);
    } catch (error) {
      console.error('Failed to open URL:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(claimUrl);
      toast.success(t('tunnel.claimUrlCopied'));
    } catch (error) {
      console.error('Failed to copy URL:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(claimCode);
      toast.success(t('tunnel.claimCodeCopied'));
    } catch (error) {
      console.error('Failed to copy code:', error);
      toast.error(t('toast.error'));
    }
  };

  const handleSaveIp = () => {
    if (!playitIp.trim()) {
      toast.error(t('tunnel.ipRequired'));
      return;
    }

    // 驗證 IP 格式（簡單驗證）
    const ipPattern = /^[a-z0-9-]+\.(?:playit|ply)\.gg:\d{4,5}$/i;
    if (!ipPattern.test(playitIp.trim())) {
      toast.error(t('tunnel.invalidIpFormat'));
      return;
    }

    if (onSaveIp) {
      onSaveIp(serverId, playitIp.trim());
    }
    toast.success(t('tunnel.ipSaved'));
    onOpenChange(false);
    // 重置狀態
    setShowIpInput(false);
    setPlayitIp('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('tunnel.claimTitle')}
          </DialogTitle>
          <DialogDescription>
            {showIpInput ? t('tunnel.enterIpDescription') : t('tunnel.claimDescription')}
          </DialogDescription>
        </DialogHeader>

        {!showIpInput ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('tunnel.claimCode')}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                  {claimCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('tunnel.claimUrl')}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {claimUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('tunnel.playitIp')}</label>
              <Input
                placeholder="example.playit.gg:25565"
                value={playitIp}
                onChange={(e) => setPlayitIp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveIp();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t('tunnel.ipFormatHint')}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!showIpInput ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={handleOpenUrl}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('tunnel.openClaimPage')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowIpInput(false)}>
                {t('common.back')}
              </Button>
              <Button onClick={handleSaveIp}>
                <Save className="mr-2 h-4 w-4" />
                {t('common.save')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
