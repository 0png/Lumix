import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout';
import { ThemeProvider, LanguageProvider } from '@/contexts';
import '@/i18n';

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <MainLayout>
          <Toaster position="bottom-right" richColors />
        </MainLayout>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
