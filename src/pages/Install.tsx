import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Music, Download, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <Music className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Install Music Detector</h1>
          <p className="text-muted-foreground">
            Install our app for the best experience with offline support and quick access
          </p>
        </div>

        {isInstalled ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="w-5 h-5" />
              <span className="font-semibold">App Installed Successfully!</span>
            </div>
            <Button onClick={() => navigate("/")} className="w-full">
              Open App
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {deferredPrompt ? (
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="w-5 h-5 mr-2" />
                Install App
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To install this app:
                </p>
                <div className="text-left space-y-2 text-sm">
                  <p><strong>On Chrome/Edge:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Tap the menu (⋮) in the browser</li>
                    <li>Select "Install app" or "Add to Home screen"</li>
                  </ol>
                  <p className="mt-4"><strong>On Safari (iOS):</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Tap the Share button</li>
                    <li>Select "Add to Home Screen"</li>
                  </ol>
                </div>
              </div>
            )}
            
            <Button 
              onClick={() => navigate("/")} 
              variant="outline" 
              className="w-full"
            >
              Continue in Browser
            </Button>
          </div>
        )}

        <div className="pt-4 border-t space-y-2">
          <h3 className="font-semibold">Why Install?</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>✓ Works offline</li>
            <li>✓ Quick access from home screen</li>
            <li>✓ Native app experience</li>
            <li>✓ Automatic updates</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default Install;
