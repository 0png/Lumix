import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout';

function App() {
  return (
    <MainLayout>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to Lumix</h1>
          <p className="text-muted-foreground">
            Select a server from the sidebar or create a new one
          </p>
        </div>
      </div>
      <Toaster position="bottom-right" richColors />
    </MainLayout>
  );
}

export default App;
