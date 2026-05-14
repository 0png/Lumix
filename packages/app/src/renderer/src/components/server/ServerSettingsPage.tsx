import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, MemoryStick, Save, ServerCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { ServerPropertyValue } from '../../../../shared/ipc-types';
import type { ServerInstance } from './ServerList';

type PropertyKind = 'boolean' | 'number' | 'text' | 'select';
type PropertySection = 'gameplay' | 'world' | 'network' | 'advanced';

interface PropertyMeta {
  key: string;
  kind: PropertyKind;
  section: PropertySection;
  defaultValue: ServerPropertyValue;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

interface ServerSettingsPageProps {
  server: ServerInstance;
  onBack?: () => void;
  onUpdate?: (updates: Partial<ServerInstance>) => Promise<void> | void;
}

const PROPERTY_META: PropertyMeta[] = [
  { key: 'gamemode', kind: 'select', section: 'gameplay', defaultValue: 'survival', options: ['survival', 'creative', 'adventure', 'spectator'] },
  { key: 'difficulty', kind: 'select', section: 'gameplay', defaultValue: 'easy', options: ['peaceful', 'easy', 'normal', 'hard'] },
  { key: 'max-players', kind: 'number', section: 'gameplay', defaultValue: 20, min: 1, max: 1000, step: 1 },
  { key: 'pvp', kind: 'boolean', section: 'gameplay', defaultValue: true },
  { key: 'hardcore', kind: 'boolean', section: 'gameplay', defaultValue: false },
  { key: 'force-gamemode', kind: 'boolean', section: 'gameplay', defaultValue: false },
  { key: 'allow-flight', kind: 'boolean', section: 'gameplay', defaultValue: false },
  { key: 'white-list', kind: 'boolean', section: 'gameplay', defaultValue: false },
  { key: 'enforce-whitelist', kind: 'boolean', section: 'gameplay', defaultValue: false },
  { key: 'online-mode', kind: 'boolean', section: 'network', defaultValue: true },
  { key: 'server-port', kind: 'number', section: 'network', defaultValue: 25565, min: 1, max: 65535, step: 1 },
  { key: 'server-ip', kind: 'text', section: 'network', defaultValue: '' },
  { key: 'enable-status', kind: 'boolean', section: 'network', defaultValue: true },
  { key: 'enable-query', kind: 'boolean', section: 'network', defaultValue: false },
  { key: 'query.port', kind: 'number', section: 'network', defaultValue: 25565, min: 1, max: 65535, step: 1 },
  { key: 'enable-rcon', kind: 'boolean', section: 'network', defaultValue: false },
  { key: 'rcon.port', kind: 'number', section: 'network', defaultValue: 25575, min: 1, max: 65535, step: 1 },
  { key: 'rcon.password', kind: 'text', section: 'network', defaultValue: '' },
  { key: 'motd', kind: 'text', section: 'world', defaultValue: 'A Minecraft Server' },
  { key: 'level-name', kind: 'text', section: 'world', defaultValue: 'world' },
  { key: 'level-seed', kind: 'text', section: 'world', defaultValue: '' },
  { key: 'level-type', kind: 'text', section: 'world', defaultValue: 'minecraft:normal' },
  { key: 'generate-structures', kind: 'boolean', section: 'world', defaultValue: true },
  { key: 'allow-nether', kind: 'boolean', section: 'world', defaultValue: true },
  { key: 'spawn-animals', kind: 'boolean', section: 'world', defaultValue: true },
  { key: 'spawn-monsters', kind: 'boolean', section: 'world', defaultValue: true },
  { key: 'spawn-npcs', kind: 'boolean', section: 'world', defaultValue: true },
  { key: 'spawn-protection', kind: 'number', section: 'world', defaultValue: 16, min: 0, max: 64, step: 1 },
  { key: 'view-distance', kind: 'number', section: 'advanced', defaultValue: 10, min: 2, max: 32, step: 1 },
  { key: 'simulation-distance', kind: 'number', section: 'advanced', defaultValue: 10, min: 2, max: 32, step: 1 },
  { key: 'enable-command-block', kind: 'boolean', section: 'advanced', defaultValue: false },
  { key: 'op-permission-level', kind: 'number', section: 'advanced', defaultValue: 4, min: 1, max: 4, step: 1 },
  { key: 'function-permission-level', kind: 'number', section: 'advanced', defaultValue: 2, min: 1, max: 4, step: 1 },
  { key: 'player-idle-timeout', kind: 'number', section: 'advanced', defaultValue: 0, min: 0, max: 1440, step: 1 },
  { key: 'max-tick-time', kind: 'number', section: 'advanced', defaultValue: 60000, min: -1, max: 300000, step: 1000 },
  { key: 'network-compression-threshold', kind: 'number', section: 'advanced', defaultValue: 256, min: -1, max: 4096, step: 1 },
  { key: 'resource-pack', kind: 'text', section: 'advanced', defaultValue: '' },
  { key: 'require-resource-pack', kind: 'boolean', section: 'advanced', defaultValue: false },
  { key: 'resource-pack-sha1', kind: 'text', section: 'advanced', defaultValue: '' },
];

const SECTION_ORDER: PropertySection[] = ['gameplay', 'world', 'network', 'advanced'];

function coerceValue(meta: PropertyMeta, value: string | undefined): ServerPropertyValue {
  if (value === undefined || value === '') return meta.defaultValue;
  if (meta.kind === 'boolean') return value === 'true';
  if (meta.kind === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : meta.defaultValue;
  }
  return value.replace('\\:', ':');
}

function toSaveValue(meta: PropertyMeta, value: ServerPropertyValue): ServerPropertyValue {
  if (meta.kind === 'text' && typeof value === 'string') {
    return meta.key === 'level-type' ? value.replace(':', '\\:') : value;
  }
  return value;
}

function SettingsSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-border/60 p-3 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ServerSettingsPage({ server, onBack, onUpdate }: ServerSettingsPageProps) {
  const { t } = useTranslation();
  const [serverName, setServerName] = useState(server.name);
  const [ramMax, setRamMax] = useState(server.ramMax);
  const [properties, setProperties] = useState<Record<string, ServerPropertyValue>>({});
  const [initialProperties, setInitialProperties] = useState<Record<string, ServerPropertyValue>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isRunning = server.status === 'running';

  useEffect(() => {
    setServerName(server.name);
    setRamMax(server.ramMax);
  }, [server.name, server.ramMax]);

  useEffect(() => {
    const loadProperties = async () => {
      setIsLoading(true);
      try {
        const result = await window.electronAPI.server.getPropertiesRaw(server.id);
        const raw = result.success && result.data ? result.data : {};
        const next = PROPERTY_META.reduce<Record<string, ServerPropertyValue>>((acc, meta) => {
          acc[meta.key] = coerceValue(meta, raw[meta.key]);
          return acc;
        }, {});
        setProperties(next);
        setInitialProperties(next);
      } catch {
        const next = PROPERTY_META.reduce<Record<string, ServerPropertyValue>>((acc, meta) => {
          acc[meta.key] = meta.defaultValue;
          return acc;
        }, {});
        setProperties(next);
        setInitialProperties(next);
      } finally {
        setIsLoading(false);
      }
    };

    loadProperties();
  }, [server.id]);

  const isDirty = useMemo(
    () =>
      serverName !== server.name ||
      ramMax !== server.ramMax ||
      PROPERTY_META.some((meta) => properties[meta.key] !== initialProperties[meta.key]),
    [initialProperties, properties, ramMax, server.name, server.ramMax, serverName]
  );

  const updateProperty = (key: string, value: ServerPropertyValue) => {
    setProperties((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (serverName !== server.name || ramMax !== server.ramMax) {
        await onUpdate?.({ name: serverName, ramMax });
      }

      const updates = PROPERTY_META.reduce<Record<string, ServerPropertyValue>>((acc, meta) => {
        if (properties[meta.key] !== initialProperties[meta.key]) {
          acc[meta.key] = toSaveValue(meta, properties[meta.key] ?? meta.defaultValue);
        }
        return acc;
      }, {});

      if (Object.keys(updates).length > 0) {
        const result = await window.electronAPI.server.updateProperties({
          id: server.id,
          properties: updates,
        });

        if (!result.success) {
          toast.error(t('toast.propertiesSaveFailed'));
          return;
        }

        setInitialProperties(properties);
      }

      toast.success(t('toast.propertiesSaved'));
    } catch {
      toast.error(t('toast.propertiesSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderControl = (meta: PropertyMeta) => {
    const value = properties[meta.key] ?? meta.defaultValue;

    if (meta.kind === 'boolean') {
      return (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => updateProperty(meta.key, checked)}
          disabled={isRunning}
        />
      );
    }

    if (meta.kind === 'select') {
      return (
        <Select
          value={String(value)}
          onValueChange={(nextValue) => updateProperty(meta.key, nextValue)}
          disabled={isRunning}
        >
          <SelectTrigger className="h-9 bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {meta.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`${meta.key}.${option}`, option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (meta.kind === 'number') {
      return (
        <div className="flex items-center gap-3">
          <Slider
            value={[Number(value)]}
            onValueChange={(values) => values[0] !== undefined && updateProperty(meta.key, values[0])}
            min={meta.min}
            max={meta.max}
            step={meta.step}
            disabled={isRunning}
            className="min-w-32 flex-1"
          />
          <Input
            type="number"
            value={Number(value)}
            min={meta.min}
            max={meta.max}
            step={meta.step}
            onChange={(event) => updateProperty(meta.key, Number(event.target.value))}
            disabled={isRunning}
            className="h-9 w-24 text-right tabular-nums"
          />
        </div>
      );
    }

    return (
      <Input
        value={String(value)}
        onChange={(event) => updateProperty(meta.key, event.target.value)}
        disabled={isRunning}
        className="h-9 bg-secondary/40"
      />
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 -ml-2 text-xs focus-ring">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          {t('common.back')}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || isSaving || isLoading || isRunning}
          className="h-8 text-xs ripple"
        >
          {isSaving ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          )}
          {t('common.save')}
        </Button>
      </div>

      <div className="rounded-lg border border-border/60 bg-gradient-subtle px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-1.5">
                <ServerCog className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <h1 className="truncate text-xl font-bold tracking-tight">{t('server.settingsTitle')}</h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('server.settingsDescription')}</p>
          </div>
          <Badge variant={isRunning ? 'success' : 'outline'} className="shrink-0">
            {isRunning ? t('server.running') : t('server.stopped')}
          </Badge>
        </div>
      </div>

      {isRunning && (
        <div className="rounded-lg border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          {t('server.settingsLocked')}
        </div>
      )}

      <Card className="glass">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">{t('server.basicSettings')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="server-name" className="text-xs text-muted-foreground">{t('server.name')}</Label>
            <Input
              id="server-name"
              value={serverName}
              onChange={(event) => setServerName(event.target.value)}
              disabled={isRunning}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t('server.ram')}</Label>
              <span className="flex items-center gap-1 text-xs font-medium tabular-nums">
                <MemoryStick className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                {ramMax} MB
              </span>
            </div>
            <Slider
              value={[ramMax]}
              onValueChange={(values) => values[0] !== undefined && setRamMax(values[0])}
              min={512}
              max={16384}
              step={512}
              disabled={isRunning}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {isLoading ? (
          <Card className="glass">
            <CardContent className="p-4">
              <SettingsSkeleton />
            </CardContent>
          </Card>
        ) : (
          SECTION_ORDER.map((section) => (
            <Card key={section} className="glass">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm">{t(`serverProperties.sections.${section}`)}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {PROPERTY_META.filter((meta) => meta.section === section).map((meta) => (
                    <div key={meta.key} className="rounded-lg border border-border/60 bg-card/45 p-3">
                      <div className="mb-3 min-h-12 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-sm font-medium">{t(`serverProperties.fields.${meta.key}.label`)}</Label>
                          <code className="rounded bg-secondary/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {meta.key}
                          </code>
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">
                          {t(`serverProperties.fields.${meta.key}.description`)}
                        </p>
                      </div>
                      {renderControl(meta)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Separator />
    </div>
  );
}
