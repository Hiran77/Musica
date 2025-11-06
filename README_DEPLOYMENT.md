# Music Detector - Multi-Platform Deployment Guide

## 🌐 Web App
Already deployed via Lovable. Access at your published URL.

## 🧩 Browser Extension

### Chrome/Edge Extension
1. Run `npm run build` to create production build
2. Open Chrome/Edge and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

### Firefox Extension
1. Build the project
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from `dist` folder

## 📱 Mobile App

### Prerequisites
- Node.js and npm installed
- For iOS: Mac with Xcode
- For Android: Android Studio

### Setup Instructions

1. **Export to GitHub** (via Lovable interface)
2. **Clone your repository**
   ```bash
   git clone your-repo-url
   cd your-project
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Add mobile platforms**
   ```bash
   npx cap add ios
   npx cap add android
   ```

5. **Build the web app**
   ```bash
   npm run build
   ```

6. **Sync with native platforms**
   ```bash
   npx cap sync
   ```

7. **Open in native IDEs**
   ```bash
   # For iOS (Mac only)
   npx cap open ios
   
   # For Android
   npx cap open android
   ```

### Native Audio Capture Plugin

For system audio detection on mobile, you'll need to add a native plugin:

```bash
npm install @capacitor-community/audio-recorder
npx cap sync
```

Then update the mobile-specific code to use system audio instead of microphone.

## 🔑 API Keys Required

Make sure to add these secrets in Lovable Cloud:
- `ACRCLOUD_API_KEY`
- `ACRCLOUD_API_SECRET`
- `ACRCLOUD_HOST`
- `REPLICATE_API_KEY` (for audio splitting)

## 📊 Platform Features

| Feature | Web App | Extension | Mobile |
|---------|---------|-----------|--------|
| Tab Audio | ✅ | ✅ | ❌ |
| Microphone | ✅ | ✅ | ✅ |
| System Audio | ❌ | ❌ | ✅ |
| Lyrics Search | ✅ | ✅ | ✅ |
| Audio Splitter | ✅ | ✅ | ✅ |
| History | ✅ | ✅ | ✅ |

## 🚀 Next Steps

1. Test web app functionality
2. Load extension in browser for testing
3. Export to GitHub for mobile development
4. Install native audio plugins for mobile
5. Test on physical devices
