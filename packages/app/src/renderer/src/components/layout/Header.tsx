/**
 * Header 元件 - 頂部導航列
 * 顯示頁面標題
 */

import { useTranslation } from 'react-i18next';

export function Header() {
  const { t } = useTranslation();

  return (
    <header className="flex h-12 lg:h-14 items-center border-b px-4 lg:px-6">
      <h2 className="text-base lg:text-lg font-semibold">{t('header.title')}</h2>
    </header>
  );
}
