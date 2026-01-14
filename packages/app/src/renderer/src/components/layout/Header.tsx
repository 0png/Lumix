/**
 * Header 元件 - 頂部導航列
 * 支援響應式設計
 */

import { Sun, Moon, Monitor, Globe, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme, type Theme } from '@/contexts';
import { useLanguage, type Language } from '@/contexts';

export function Header() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
    { value: 'system', label: t('theme.system'), icon: Monitor },
  ];

  const languageOptions: { value: Language; label: string }[] = [
    { value: 'zh-TW', label: t('language.zhTW') },
    { value: 'en', label: t('language.en') },
  ];

  return (
    <header className="flex h-12 lg:h-14 items-center justify-between border-b px-3 lg:px-4">
      <div>
        <h2 className="text-base lg:text-lg font-semibold">{t('header.title')}</h2>
      </div>

      <div className="flex items-center gap-0.5 lg:gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-9 lg:w-9">
              <ThemeIcon className="h-4 w-4 lg:h-5 lg:w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {themeOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme(option.value)}
              >
                <option.icon className="mr-2 h-4 w-4" />
                {option.label}
                {theme === option.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 lg:h-9 lg:w-9">
              <Globe className="h-4 w-4 lg:h-5 lg:w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {languageOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setLanguage(option.value)}
              >
                {option.label}
                {language === option.value && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
