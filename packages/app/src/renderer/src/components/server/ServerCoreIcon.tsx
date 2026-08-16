import { cn } from '@/lib/utils';
import type { CoreType } from './ServerList';
import minecraftIcon from '../../../../../resources/minecraft.png';
import paperIcon from '../../../../../resources/PaperMC.png';
import fabricIcon from '../../../../../resources/Fabric.png';
import forgeIcon from '../../../../../resources/Forge.png';
import neoForgeIcon from '../../../../../resources/NeoForge.png';
import purpurIcon from '../../../../../resources/Purpur.svg';

interface ServerCoreIconProps {
  coreType: CoreType;
  className?: string;
  imageClassName?: string;
}

const CORE_ICON_SOURCES: Record<CoreType, string> = {
  vanilla: minecraftIcon,
  paper: paperIcon,
  purpur: purpurIcon,
  spigot: paperIcon,
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoForgeIcon,
};

export function ServerCoreIcon({
  coreType,
  className,
  imageClassName,
}: ServerCoreIconProps) {
  const src = CORE_ICON_SOURCES[coreType];

  return (
    <div
      className={cn(
        'flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-primary/10',
        className
      )}
    >
      <img
        src={src}
        alt=""
        className={cn('h-7 w-7 object-contain', imageClassName)}
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
