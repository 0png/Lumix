/**
 * ServerDetail 元件 - 伺服器詳細資訊
 * 設計語言與 Lumix 保持一致
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, Trash2, Settings2, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
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
  onStart?: () => void;
  onStop?: () => void;
  onDelete?: () => void;
  onUpdate?: (updates: Partial<ServerInstance>) => void;
}

/**
 * 狀態徽章元件
 */
function StatusBadge({ status }: { status: ServerStatus }) {
  const { t } = useTranslation();

  const statusConfig = {
    stopped: { color: 'bg-muted-foreground', label: t('server.stopped') },
    starting: { color: 'bg-yellow-500 animate-pulse', label: t('server.starting') },
    running: { color: 'bg-green-500', label: t('server.running') },
    stopping: { color: 'bg-yellow-500 animate-pulse', label: t('server.stopping') },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary">
      <span className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
}

/**
 * 伺服器詳細資訊元件
 */
export function ServerDetail({
  server,
  onStart,
  onStop,
  onDelete,
  onUpdate,
}: ServerDetailProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(server.name);
  const [editRamMax, setEditRamMax] = useState(server.ramMax);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isRunning = server.status === 'running';
  const isTransitioning = server.status === 'starting' || server.status === 'stopping';

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
    <div className="space-y-4">
      {/* 標題區域 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{server.name}</h2>
          <p className="text-sm text-muted-foreground">
            {t(`coreType.${server.coreType}`)} • {server.mcVersion}
          </p>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2">
        {isRunning ? (
          <Button variant="destructive" size="sm" onClick={onStop} disabled={isTransitioning}>
            <Square className="mr-1" />
            {t('server.stop')}
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={isTransitioning}>
            <Play className="mr-1" />
            {t('server.start')}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          disabled={isRunning}
        >
          <Settings2 className="mr-1" />
          {t('common.edit')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
          disabled={isRunning}
        >
          <Trash2 className="mr-1" />
          {t('common.delete')}
        </Button>
      </div>

      <Separator />

      {/* 設定卡片 */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('server.config')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">{t('server.coreType')}</Label>
              <p className="text-sm font-medium">{t(`coreType.${server.coreType}`)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{t('server.version')}</Label>
              <p className="text-sm font-medium">{server.mcVersion}</p>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('server.ram')}</Label>
            <div className="flex items-center gap-1">
              <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-sm font-medium">{server.ramMax} MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 編輯對話框 */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.edit')} {server.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('server.name')}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('createServer.maxRam')}</Label>
                <span className="text-sm text-muted-foreground">{editRamMax} MB</span>
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
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('server.delete')}</DialogTitle>
            <DialogDescription>
              {t('server.name')}: {server.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete?.();
                setShowDeleteDialog(false);
              }}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
