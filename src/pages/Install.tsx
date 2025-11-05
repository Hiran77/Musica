import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, CheckCircle, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

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
    }

    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-gray-900/50 border-green-500/20 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Already Installed!</h1>
          <p className="text-gray-400 mb-6">
            Music Detector is installed on your device. You can launch it from your home screen.
          </p>
          <Button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500"
          >
            Go to App
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-gray-900/50 border-green-500/20">
        <div className="text-center mb-6">
          <Smartphone className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Install Music Detector</h1>
          <p className="text-gray-400">
            Get instant access to music detection directly from your home screen
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3 text-left">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Works Offline</p>
              <p className="text-sm text-gray-400">Access the app even without internet</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-left">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">Instant Launch</p>
              <p className="text-sm text-gray-400">Open directly from your home screen</p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-left">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-white font-medium">No App Store Required</p>
              <p className="text-sm text-gray-400">Install directly from your browser</p>
            </div>
          </div>
        </div>

        {isIOS ? (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
            <p className="text-white font-medium mb-2">Installation Steps for iOS:</p>
            <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
              <li>Tap the Share button in Safari</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" in the top right corner</li>
            </ol>
          </div>
        ) : deferredPrompt ? (
          <Button
            onClick={handleInstall}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            Install App
          </Button>
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
            <p className="text-white font-medium mb-2">Installation Steps:</p>
            <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
              <li>Click the menu button (⋮) in your browser</li>
              <li>Select "Install app" or "Add to Home Screen"</li>
              <li>Follow the prompts to complete installation</li>
            </ol>
          </div>
        )}

        <Button
          onClick={() => navigate('/')}
          variant="outline"
          className="w-full mt-4 border-green-500/30"
        >
          Continue in Browser
        </Button>
      </Card>
    </div>
  );
};

export default Install;
