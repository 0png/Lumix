/**
 * ServerDetail 元件 - 伺服器詳細資訊
 * 設計語言與 Lumix 保持一致
 * 支援響應式設計、無障礙、Loading 狀態
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Play, Square, Trash2, Settings2, MemoryStick, 
  ArrowLeft, FolderOpen, AlertTriangle, SlidersHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ServerInstance, ServerStatus } from './ServerList';

interface ServerDetailProps {
  server: ServerInstance;
  directory?: string;
  onBack?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  onDelete?: () => void;
  onUpdate?: (updates: Partial<ServerInstance>) => void;
  onOpenFolder?: () => void;
  onOpenSettings?: () => void;
}

/**
 * 狀態徽章元件 - 帶光暈效果和無障礙支援
 */
function StatusBadge({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { color: 'bg-muted-foreground', label: t('server.stopped'), variant: 'ghost' as const },
    starting: { color: 'status-glow-transitioning', label: t('server.starting'), variant: 'warning' as const },
    running: { color: 'status-glow-running', label: t('server.running'), variant: 'success' as const },
    stopping: { color: 'status-glow-transitioning', label: t('server.stopping'), variant: 'warning' as const },
  };

  const config = statusConfig[status];

  return (
    <Badge 
      variant={config.variant}
      className="gap-1.5 px-2 lg:px-3 py-0.5 lg:py-1"
      role="status"
      aria-label={`${t('server.status')}: ${config.label}`}
    >
      <span className={cn('h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full transition-all duration-300', config.color)} aria-hidden="true" />
      <span className="text-xs lg:text-sm font-medium">{config.label}</span>
    </Badge>
  );
}

/**
 * 伺服器詳細資訊元件
 */
export function ServerDetail({
  server,
  onBack,
  onStart,
  onStop,
  onDelete,
  onUpdate,
  onOpenFolder,
  onOpenSettings,
}: ServerDetailProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editRamMax, setEditRamMax] = useState(server.ramMax);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isRunning = server.status === 'running';
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';
  const isReady = server.isReady !== false;

  const handleSave = () => {
    onUpdate?.({ name: editName, ramMax: editRamMax });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(server.name);
    setEditRamMax(server.ramMax);
    setIsEditing(false);
  };

  return (
    <div className="space-y-3 lg:space-y-4 animate-fade-in">
      {/* 返回按鈕 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-7 lg:h-8 text-xs lg:text-sm -ml-2 focus-ring"
        aria-label={t('common.back')}
      >
        <ArrowLeft className="mr-1 h-3 w-3 lg:h-4 lg:w-4" aria-hidden="true" />
        {t('common.back')}
      </Button>

      {/* 標題區域 */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg lg:text-xl font-bold tracking-tight truncate">{server.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[10px] lg:text-xs">
              {t(`coreType.${server.coreType}`)}
            </Badge>
            <span className="text-xs lg:text-sm text-muted-foreground">{server.mcVersion}</span>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-1.5 lg:gap-2" role="toolbar" aria-label={t('server.actions', '伺服器操作')}>
        {isRunning ? (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={onStop} 
            disabled={isTransitioning} 
            className="h-8 text-xs ripple"
            aria-label={t('server.stop')}
          >
            <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t('server.stop')}
          </Button>
        ) : (
          <Button 
            size="sm" 
            onClick={onStart} 
            disabled={isTransitioning || !isReady} 
            className="h-8 text-xs ripple"
            aria-label={!isReady ? t('server.downloading') : t('server.start')}
          >
            <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {!isReady ? t('server.downloading') : t('server.start')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          disabled={isRunning}
          className="h-8 text-xs"
          aria-label={t('common.edit')}
        >
          <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('common.edit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="h-8 text-xs"
          aria-label={t('server.settingsTitle')}
        >
          <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('server.settingsTitle')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFolder}
          className="h-8 text-xs"
          aria-label={t('server.openFolder')}
        >
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('server.openFolder')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive h-8 text-xs"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isRunning}
          aria-label={t('common.delete')}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('common.delete')}
        </Button>
      </div>

      <Separator />

      {/* 設定卡片 */}
      <Card className="glass">
        <CardHeader className="p-3 lg:p-4 pb-1.5 lg:pb-2">
          <CardTitle className="text-xs lg:text-sm">{t('server.config')}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 lg:p-4 pt-0 space-y-2 lg:space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:gap-3">
            <div>
              <Label className="text-[10px] lg:text-xs text-muted-foreground">{t('server.coreType')}</Label>
              <p className="text-xs lg:text-sm font-medium">{t(`coreType.${server.coreType}`)}</p>
            </div>
            <div>
              <Label className="text-[10px] lg:text-xs text-muted-foreground">{t('server.version')}</Label>
              <p className="text-xs lg:text-sm font-medium">{server.mcVersion}</p>
            </div>
          </div>
          <div>
            <Label className="text-[10px] lg:text-xs text-muted-foreground">{t('server.ram')}</Label>
            <div className="flex items-center gap-1">
              <MemoryStick className="h-3 w-3 lg:h-3.5 lg:w-3.5 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs lg:text-sm font-medium">{server.ramMax} MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 編輯對話框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-lg">{t('common.edit')} {server.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 lg:space-y-4 py-3 lg:py-4">
            <div className="space-y-1.5 lg:space-y-2">
              <Label htmlFor="edit-name" className="text-xs lg:text-sm">{t('server.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-8 lg:h-9 text-xs lg:text-sm"
              />
            </div>
            <div className="space-y-1.5 lg:space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs lg:text-sm">{t('createServer.maxRam')}</Label>
                <span className="text-xs lg:text-sm text-muted-foreground">{editRamMax} MB</span>
              </div>
              <Slider
                value={[editRamMax]}
                onValueChange={(values) => values[0] !== undefined && setEditRamMax(values[0])}
                min={512}
                max={16384}
                step={512}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel} className="h-8 lg:h-9 text-xs lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} className="h-8 lg:h-9 text-xs lg:text-sm ripple">{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 - 加入警告文字 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base lg:text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
              {t('server.delete')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs lg:text-sm space-y-2 text-muted-foreground">
                <p>{t('server.deleteConfirm', '確定要刪除此伺服器嗎？')}</p>
                <p className="font-medium text-foreground">{t('server.name')}: {server.name}</p>
                <p className="text-destructive">{t('server.deleteWarning', '此操作無法復原，所有伺服器資料將被永久刪除。')}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="h-8 lg:h-9 text-xs lg:text-sm">
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
              className="h-8 lg:h-9 text-xs lg:text-sm ripple"
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
