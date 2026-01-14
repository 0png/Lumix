import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Lumix</h1>
          <p className="text-muted-foreground">
            Minecraft Server Launcher
          </p>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

export default App;
