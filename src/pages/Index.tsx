import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Music, Loader2, CheckCircle2, XCircle, MonitorPlay, Radio, Youtube, Music2, Apple, Cloud, ShoppingCart, ExternalLink, User, BarChart3, RotateCcw, Heart, Speaker } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LyricsSearch } from "@/components/LyricsSearch";
import { AudioSplitter } from "@/components/AudioSplitter";
import { useUserRole } from "@/hooks/useUserRole";
import { Lock } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const { isPremium, isLoading: roleLoading } = useUserRole();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureMode, setCaptureMode] = useState<"microphone" | "tab" | "system">("tab");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const isMobile = useIsMobile();
  const MAX_RECORD_SECONDS = 30;
  const [detectedSong, setDetectedSong] = useState<{
    title: string;
    artist: string;
    album?: string;
    confidence?: number;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    
    // Set initial capture mode for mobile
    if (isMobile || Capacitor.isNativePlatform()) {
      setCaptureMode("system");
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [isMobile]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const saveDetectionToHistory = async (song: { title: string; artist: string; album?: string; confidence?: number }) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('detection_history')
        .insert({
          user_id: user.id,
          song_title: song.title,
          artist: song.artist,
          album: song.album,
          confidence: song.confidence,
        });

      if (error) throw error;

      console.log('Detection saved to history');
      setIsSaved(true);
      toast({
        title: "Saved!",
        description: "Song added to your history",
      });
    } catch (error: any) {
      console.error('Error saving detection:', error.message);
      toast({
        title: "Error",
        description: "Failed to save to history",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setDetectedSong(null);
    setIsSaved(false);
    setRecordingDuration(0);
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      // Clean up any active streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log('Cleanup: Stopped track', track.kind, track.label);
        });
        streamRef.current = null;
      }
    };
  }, []);

  const applyNoiseReduction = async (audioBlob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    // Create source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;

    // High-pass filter to remove low-frequency noise (wind, rumble)
    const highPassFilter = offlineContext.createBiquadFilter();
    highPassFilter.type = "highpass";
    highPassFilter.frequency.value = 100;
    highPassFilter.Q.value = 1;

    // Low-pass filter to remove high-frequency noise
    const lowPassFilter = offlineContext.createBiquadFilter();
    lowPassFilter.type = "lowpass";
    lowPassFilter.frequency.value = 8000;
    lowPassFilter.Q.value = 1;

    // Compressor to even out volume levels
    const compressor = offlineContext.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    // Connect nodes
    source.connect(highPassFilter);
    highPassFilter.connect(lowPassFilter);
    lowPassFilter.connect(compressor);
    compressor.connect(offlineContext.destination);

    source.start();
    const renderedBuffer = await offlineContext.startRendering();

    // Convert back to blob
    const wavBlob = await audioBufferToWav(renderedBuffer);
    return wavBlob;
  };

  const audioBufferToWav = (buffer: AudioBuffer): Promise<Blob> => {
    const length = buffer.length * buffer.numberOfChannels * 2;
    const wav = new ArrayBuffer(44 + length);
    const view = new DataView(wav);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, buffer.numberOfChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
    view.setUint16(32, buffer.numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length, true);

    // Write PCM data
    const channels = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return Promise.resolve(new Blob([wav], { type: "audio/wav" }));
  };

  const detectSilence = (stream: MediaStream) => {
    // Create audio context and analyser
    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    analyserRef.current = analyser;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let silenceStart = 0;
    const SILENCE_THRESHOLD = 3; // Lower threshold - values below this are truly silent
    const SILENCE_DURATION = 7000; // 7 seconds of silence before auto-stop
    
    const checkAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyser.getByteTimeDomainData(dataArray);
      
      // Calculate average volume (more accurate method)
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(dataArray[i] - 128);
        sum += value;
      }
      const average = sum / bufferLength;
      
      // Detect true silence (very low audio level)
      if (average < SILENCE_THRESHOLD) {
        if (silenceStart === 0) {
          silenceStart = Date.now();
          console.log('True silence detected, average volume:', average);
        } else {
          const silenceDuration = Date.now() - silenceStart;
          if (silenceDuration > SILENCE_DURATION) {
            console.log('Auto-stopping due to 7s silence, duration:', recordingDuration);
            if (mediaRecorderRef.current?.state === "recording") {
              toast({
                title: "Audio stopped",
                description: "Silence detected, processing recording...",
              });
              stopRecording();
            }
            return;
          }
        }
      } else {
        // Reset silence timer if any sound is detected
        if (silenceStart !== 0) {
          console.log('Sound detected, volume:', average, '- resetting silence timer');
        }
        silenceStart = 0;
      }
      
      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const startRecording = async () => {
    try {
      let stream: MediaStream;
      
      if (captureMode === "tab") {
        // Capture audio from browser tab (YouTube, Spotify, etc.)
        stream = await navigator.mediaDevices.getDisplayMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: true, // Required by browser, but we only use audio
        });
        
        console.log('Screen sharing started, tracks:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
        
        // Stop video track immediately as we only need audio
        stream.getVideoTracks().forEach(track => {
          track.stop();
          console.log('Stopped video track:', track.label);
        });
        
        // Store stream reference for later cleanup
        streamRef.current = stream;
        
        // Add ended event listener to detect when user stops sharing manually
        stream.getAudioTracks().forEach(track => {
          track.addEventListener('ended', () => {
            console.log('Screen sharing stopped by user');
            if (isRecording) {
              stopRecording();
            }
          });
        });
      } else {
        // Capture from microphone
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        
        streamRef.current = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, processing audio...');
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        
        toast({
          title: "Cleaning audio",
          description: "Removing noise and enhancing quality...",
        });
        
        // Apply noise reduction
        const cleanedAudio = await applyNoiseReduction(audioBlob);
        await processAudio(cleanedAudio);
        
        // Clean up stream after processing
        if (streamRef.current) {
          console.log('Stopping all stream tracks after recording...');
          streamRef.current.getTracks().forEach((track) => {
            track.stop();
            console.log('Stopped track:', track.kind, track.label);
          });
          streamRef.current = null;
        }
        
        // Return focus to the app window
        window.focus();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDetectedSong(null);
      setRecordingDuration(0);
      
      // Start silence detection
      detectSilence(stream);
      
      // Start duration timer with max cap
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS && mediaRecorderRef.current?.state === 'recording') {
            console.log('Max duration reached, auto-stopping...');
            stopRecording();
          }
          return next;
        });
      }, 1000);
      
      const modeText = captureMode === "tab" ? "tab" : captureMode === "system" ? "system" : "microphone";
      toast({
        title: "Recording started",
        description: `Recording ${modeText} audio. Will auto-stop when audio ends.`,
      });
    } catch (error) {
      console.error("Error accessing audio:", error);
      toast({
        title: "Error",
        description: captureMode === "tab" 
          ? "Could not access tab audio. Please select a tab and allow audio sharing."
          : "Could not access microphone. Please grant permission.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      console.log('Stopping recording...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop stream tracks immediately when stopping recording
      if (streamRef.current) {
        console.log('Stopping stream tracks during stopRecording...');
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log('Stopped track:', track.kind, track.label);
        });
        streamRef.current = null;
      }
    }
  };

  const getMusicPlatformUrls = (title: string, artist: string) => {
    const query = `${title} ${artist}`;
    const encodedQuery = encodeURIComponent(query);
    const origin = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    
    return {
      youtube: `https://www.youtube.com/results?search_query=${encodedQuery}`,
      youtubeEmbed: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodedQuery}&origin=${origin}&modestbranding=1&rel=0`,
      spotify: `https://open.spotify.com/search/${encodedQuery}`,
      appleMusic: `https://music.apple.com/search?term=${encodedQuery}`,
      soundcloud: `https://soundcloud.com/search?q=${encodedQuery}`,
      amazonMusic: `https://music.amazon.com/search/${encodedQuery}`,
    };
  };
  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(",")[1];
        
        if (!base64Audio) {
          throw new Error("Failed to convert audio");
        }

        const { data, error } = await supabase.functions.invoke("detect-music", {
          body: { audio: base64Audio },
        });

        if (error) throw error;

        if (data.success && data.song) {
          setDetectedSong(data.song);

          // Ensure UI leaves listening state
          setIsRecording(false);

          console.log('Song detected! Ensuring screen sharing is stopped...');

          // If still recording for any reason, stop it now
          if (mediaRecorderRef.current?.state === 'recording') {
            console.log('Still recording after detection — forcing stop');
            mediaRecorderRef.current.stop();
          }

          // Double-check stream is stopped on successful detection
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
              if (track.readyState === 'live') {
                track.stop();
                console.log('Force stopped active track:', track.kind, track.label);
              }
            });
            streamRef.current = null;
          }

          // Return focus to app and navigate to home to avoid staying on shared tab
          window.focus();
          setTimeout(() => navigate('/'), 100);

          // Auto-save to history if user is logged in
          if (user) {
            await saveDetectionToHistory(data.song);
          }

          const confidence = data.song.confidence || 0;

          if (confidence >= 80) {
            toast({
              title: "Song detected!",
              description: `${data.song.title} by ${data.song.artist} (${confidence}% confidence)`,
            });
          } else if (confidence >= 60) {
            toast({
              title: "Possible match",
              description: `${data.song.title} by ${data.song.artist} (${confidence}% confidence). Try recording longer for better accuracy.`,
            });
          } else {
            toast({
              title: "Low confidence match",
              description: "Try recording for at least 15-20 seconds with clearer audio.",
            });
          }
        } else {
          setDetectedSong(null);
          const message = recordingDuration < 10 
            ? "Recording too short. Try recording for at least 10-15 seconds."
            : "Could not identify the song. Try recording longer or move closer to the audio source.";
          
          toast({
            title: "No match found",
            description: message,
            variant: "destructive",
          });
        }
      };
    } catch (error: any) {
      console.error("Error processing audio:", error);
      toast({
        title: "Processing error",
        description: error.message || "Failed to process audio",
        variant: "destructive",
      });
      setDetectedSong(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-primary/5 to-background overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary-glow/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-accent/20 rounded-full blur-3xl animate-pulse-slow" />
        </div>
      </div>

      {/* Mobile Shazam-like UI */}
      {isMobile ? (
        <div className="relative z-10 flex-1 flex flex-col p-4 overflow-hidden">
          {/* Header */}
          <div className="text-center pt-4 pb-2 animate-fade-in">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/20 p-4 border-2 border-primary/30 pulse-glow">
                <Music className="h-10 w-10 text-primary animate-float" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2 gradient-text">Musica</h1>
            <p className="text-sm text-muted-foreground">
              {captureMode === "system" ? "System Audio Detection" : "Microphone Detection"}
            </p>
          </div>

          {/* Main Content - Centered */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 pb-24 overflow-y-auto">
            {/* Large Circular Button - Shazam Style */}
            <div className="relative animate-scale-in">
              {/* Pulse Animation Ring when recording */}
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                </>
              )}
              
              {/* Main Button */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`
                  relative w-56 h-56 rounded-full flex flex-col items-center justify-center gap-3
                  smooth-transition shadow-2xl
                  ${isRecording 
                    ? 'bg-gradient-to-br from-red-500 to-red-600 text-white scale-95 animate-pulse-slow' 
                    : isProcessing
                    ? 'bg-gradient-to-br from-primary to-primary-glow text-primary-foreground animate-pulse'
                    : 'bg-gradient-to-br from-primary to-primary-glow text-primary-foreground pulse-glow'
                  }
                  ${!isProcessing && !isRecording ? 'hover:scale-105 active:scale-95' : ''}
                  disabled:opacity-50
                `}
                style={{
                  boxShadow: isRecording 
                    ? '0 0 60px hsl(0 84% 60% / 0.5), 0 0 100px hsl(0 84% 60% / 0.3)' 
                    : '0 0 60px hsl(var(--primary) / 0.4), 0 0 100px hsl(var(--primary) / 0.2)'
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-16 w-16 animate-spin" />
                    <span className="text-sm font-medium">Processing...</span>
                  </>
                ) : isRecording ? (
                  <>
                    <div className="w-12 h-12 rounded bg-white/90 animate-pulse" />
                    <span className="text-2xl font-bold">{recordingDuration}s</span>
                    <span className="text-xs opacity-90">Tap to stop</span>
                  </>
                ) : (
                  <>
                    {captureMode === "system" ? (
                      <Speaker className="h-20 w-20 animate-float" />
                    ) : (
                      <Mic className="h-20 w-20 animate-float" />
                    )}
                    <span className="text-sm font-medium">Tap to detect</span>
                  </>
                )}
              </button>
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="text-center space-y-2 animate-fade-in">
                <p className="text-lg font-semibold">Listening...</p>
                <p className="text-sm text-muted-foreground">
                  {recordingDuration < 10 
                    ? "Keep recording (min 10s)" 
                    : "Auto-stops on silence"}
                </p>
              </div>
            )}

            {/* Mode Toggle */}
            {!isRecording && !isProcessing && !detectedSong && (
              <button
                onClick={() => setCaptureMode(captureMode === "system" ? "microphone" : "system")}
                className="flex items-center gap-3 px-6 py-3 rounded-full glass-effect border-2 border-border hover:border-primary smooth-transition hover-lift"
              >
                {captureMode === "system" ? (
                  <>
                    <div className="rounded-full bg-primary/20 p-2">
                      <Speaker className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">System Audio</p>
                      <p className="text-xs text-muted-foreground">Tap to switch to mic</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/20 p-2">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">Microphone</p>
                      <p className="text-xs text-muted-foreground">Tap to switch to system</p>
                    </div>
                  </>
                )}
              </button>
            )}

            {/* Detection Result - Compact for Mobile */}
            {detectedSong && (
              <div className="w-full max-w-sm space-y-4 animate-fade-up">
                <Card className="border-green-500/50 glass-effect bg-green-500/5 hover-lift">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="rounded-full bg-green-500/20 p-2">
                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl break-words">{detectedSong.title}</h3>
                        <p className="text-base text-muted-foreground break-words">{detectedSong.artist}</p>
                        {detectedSong.confidence && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-green-500 transition-all duration-500"
                                style={{ width: `${detectedSong.confidence}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-green-600">
                              {detectedSong.confidence}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleRetry}
                        variant="outline"
                        size="sm"
                        className="gap-2 flex-1"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Retry
                      </Button>
                      {user && !isSaved && (
                        <Button
                          onClick={() => saveDetectionToHistory(detectedSong)}
                          variant="default"
                          size="sm"
                          className="gap-2 flex-1"
                        >
                          <Heart className="h-4 w-4" />
                          Save
                        </Button>
                      )}
                    </div>

                    {/* Music Platforms - Compact Grid */}
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Listen on:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" className="gap-2 bg-red-500/10 border-red-500/20" asChild>
                          <a href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).youtube} target="_blank" rel="noopener noreferrer">
                            <Youtube className="h-4 w-4 text-red-500" />
                            YouTube
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 bg-green-500/10 border-green-500/20" asChild>
                          <a href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).spotify} target="_blank" rel="noopener noreferrer">
                            <Music2 className="h-4 w-4 text-green-500" />
                            Spotify
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 bg-pink-500/10 border-pink-500/20" asChild>
                          <a href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).appleMusic} target="_blank" rel="noopener noreferrer">
                            <Apple className="h-4 w-4 text-pink-500" />
                            Apple
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2 bg-orange-500/10 border-orange-500/20" asChild>
                          <a href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).soundcloud} target="_blank" rel="noopener noreferrer">
                            <Cloud className="h-4 w-4 text-orange-500" />
                            SoundCloud
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Desktop UI */
        <div className="relative p-3 sm:p-4 md:p-6 lg:p-8 pb-20 md:pb-8">
          {/* Subtle Background Animation for Desktop */}
          <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary-glow/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
          </div>
          
          <div className="relative container mx-auto max-w-4xl">
            <div className="mb-6 sm:mb-8 text-center animate-fade-in">
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div className="rounded-full bg-primary/10 p-3 sm:p-4 pulse-glow">
                  <Music className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary animate-float" />
                </div>
              </div>
              <h1 className="mb-2 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight gradient-text">Musica</h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground px-4">
                Detect music by sound or search by lyrics
              </p>
            </div>

            <Tabs defaultValue="detect" className="w-full mb-4 sm:mb-6">
              <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 h-auto">
                <TabsTrigger value="detect" className="text-xs sm:text-sm py-2 sm:py-2.5">
                  <span className="hidden sm:inline">Audio Detection</span>
                  <span className="sm:hidden">Detect</span>
                </TabsTrigger>
                <TabsTrigger value="lyrics" className="text-xs sm:text-sm py-2 sm:py-2.5">
                  <span className="hidden sm:inline">Lyrics Search</span>
                  <span className="sm:hidden">Lyrics</span>
                </TabsTrigger>
                <TabsTrigger value="splitter" className="text-xs sm:text-sm py-2 sm:py-2.5">
                  <span className="hidden sm:inline">Audio Splitter</span>
                  <span className="sm:hidden">Splitter</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="detect" className="space-y-4 sm:space-y-6 animate-fade-up">
                <Card className="border-2 glass-effect hover-lift">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">How it works</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Our AI separates music from speech and identifies songs playing in the background
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <Tabs value={captureMode} onValueChange={(v) => setCaptureMode(v as "microphone" | "tab")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="tab" className="flex items-center gap-2 text-sm">
                          <MonitorPlay className="h-4 w-4" />
                          <span className="hidden sm:inline">Tab Audio</span>
                          <span className="sm:hidden">Tab</span>
                        </TabsTrigger>
                        <TabsTrigger value="microphone" className="flex items-center gap-2 text-sm">
                          <Mic className="h-4 w-4" />
                          <span className="hidden sm:inline">Microphone</span>
                          <span className="sm:hidden">Mic</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="tab" className="mt-3 sm:mt-4">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                          Capture audio directly from YouTube, Spotify, or any browser tab
                        </p>
                      </TabsContent>
                      
                      <TabsContent value="microphone" className="mt-3 sm:mt-4">
                        <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                          Record music playing near your device's microphone
                        </p>
                      </TabsContent>
                    </Tabs>

                    <div className="flex flex-col gap-4">
                      {isRecording && (
                        <Card className="border-primary/50 bg-primary/5 animate-pulse">
                          <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <Radio className="h-6 w-6 sm:h-8 sm:w-8 text-primary animate-pulse flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base sm:text-lg">Listening...</h3>
                                <p className="text-xl sm:text-2xl font-bold text-primary">{recordingDuration}s</p>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                  {recordingDuration < 10 
                                    ? "Keep recording (min 10s)" 
                                    : "Recording... Auto-stop on silence"}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      
                      <Button
                        size="lg"
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing}
                        className="h-14 sm:h-16 text-base sm:text-lg w-full smooth-transition pulse-glow"
                        variant={isRecording ? "destructive" : "default"}
                      >
                        {isRecording ? (
                          <>
                            <Mic className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                            <span className="hidden sm:inline">Stop Recording ({recordingDuration}s)</span>
                            <span className="sm:hidden">Stop ({recordingDuration}s)</span>
                          </>
                        ) : isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Mic className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                            Start Recording
                          </>
                        )}
                      </Button>

                      {detectedSong && (
                        <>
                          {/* Success Banner */}
                          <Card className="border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1">
                                  <div className="rounded-full bg-green-500/20 p-1.5 sm:p-2 flex-shrink-0">
                                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="font-semibold text-base sm:text-lg">Song Identified!</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                      {isSaved ? "Saved to history" : user ? "Auto-saved" : "Sign in to save"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                  <Button
                                    onClick={handleRetry}
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 flex-1 sm:flex-initial"
                                  >
                                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">Retry</span>
                                    <span className="sm:hidden">Retry</span>
                                  </Button>
                                  {user && !isSaved && (
                                    <Button
                                      onClick={() => saveDetectionToHistory(detectedSong)}
                                      variant="default"
                                      size="sm"
                                      className="gap-2 flex-1 sm:flex-initial"
                                    >
                                      <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                                      <span className="hidden sm:inline">Save</span>
                                      <span className="sm:hidden">Save</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Detection Results */}
                          <Card className="border-green-500/50 bg-green-500/5">
                            <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                              <div className="flex items-start gap-2 sm:gap-3">
                                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0 mt-1" />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-base sm:text-lg break-words">{detectedSong.title}</h3>
                                  <p className="text-sm sm:text-base text-muted-foreground break-words">{detectedSong.artist}</p>
                                  {detectedSong.album && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Album: {detectedSong.album}
                                    </p>
                                  )}
                                  {detectedSong.confidence && (
                                    <div className="mt-3 flex items-center gap-2">
                                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-green-500 transition-all duration-500"
                                          style={{ width: `${detectedSong.confidence}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium text-green-600">
                                        {detectedSong.confidence}%
                                      </span>
                                    </div>
                                  )}
                                
                                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-green-500/20">
                                  <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Now Playing:</h4>
                                  <div className="mb-3 sm:mb-4 rounded-lg overflow-hidden bg-black/5">
                                    <iframe
                                      width="100%"
                                      height="200"
                                      src={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).youtubeEmbed}
                                      title="YouTube Music Player"
                                      frameBorder="0"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                      referrerPolicy="strict-origin-when-cross-origin"
                                      className="w-full aspect-video sm:aspect-auto"
                                    />
                                  </div>
                                  
                                  <h4 className="text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Or listen on:</h4>
                                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="justify-start gap-1.5 sm:gap-2 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-xs sm:text-sm px-2 sm:px-3"
                                      asChild
                                    >
                                      <a
                                        href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).youtube}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Youtube className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                                        <span className="hidden xs:inline">YouTube</span>
                                        <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-auto opacity-50" />
                                      </a>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="justify-start gap-1.5 sm:gap-2 bg-green-500/10 border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30 text-xs sm:text-sm px-2 sm:px-3"
                                      asChild
                                    >
                                      <a
                                        href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).spotify}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Music2 className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                                        <span className="hidden xs:inline">Spotify</span>
                                        <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-auto opacity-50" />
                                      </a>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="justify-start gap-1.5 sm:gap-2 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20 hover:border-pink-500/30 text-xs sm:text-sm px-2 sm:px-3"
                                      asChild
                                    >
                                      <a
                                        href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).appleMusic}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Apple className="h-3 w-3 sm:h-4 sm:w-4 text-pink-500 flex-shrink-0" />
                                        <span className="hidden xs:inline">Apple</span>
                                        <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-auto opacity-50" />
                                      </a>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="justify-start gap-1.5 sm:gap-2 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30 text-xs sm:text-sm px-2 sm:px-3"
                                      asChild
                                    >
                                      <a
                                        href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).soundcloud}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <Cloud className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                                        <span className="hidden xs:inline">SoundCloud</span>
                                        <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-auto opacity-50" />
                                      </a>
                                    </Button>
                                    
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="justify-start gap-1.5 sm:gap-2 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30 text-xs sm:text-sm px-2 sm:px-3"
                                      asChild
                                    >
                                      <a
                                        href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).amazonMusic}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ShoppingCart className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                                        <span className="hidden xs:inline">Amazon</span>
                                        <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-auto opacity-50" />
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    {!detectedSong && !isRecording && !isProcessing && (
                      <Card className="border-muted bg-muted/30">
                        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="rounded-full bg-muted p-1.5 sm:p-2 flex-shrink-0">
                              <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-base sm:text-lg">Ready to detect</h3>
                              <p className="text-xs sm:text-sm text-muted-foreground">
                                No song detected yet. Start recording to identify background music.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 sm:p-4 text-xs sm:text-sm">
                    <h4 className="font-semibold mb-2">Tips for best results:</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li className="text-xs sm:text-sm">• <strong>Tab Audio:</strong> Select the tab playing music when prompted</li>
                      <li className="text-xs sm:text-sm">• <strong>Microphone:</strong> Position near speakers for best quality</li>
                      <li className="text-xs sm:text-sm">• <strong>Auto-stop:</strong> Recording stops automatically after 7s of silence</li>
                      <li className="text-xs sm:text-sm">• <strong>Duration:</strong> Record for 10-15s minimum, longer for difficult songs</li>
                      <li className="text-xs sm:text-sm">• <strong>Background music:</strong> Record for 20-30s for scenes with dialogue</li>
                      <li className="text-xs sm:text-sm">• Works with YouTube, Spotify, movies, TV shows, and live music</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lyrics" className="space-y-4 sm:space-y-6">
              <LyricsSearch />
            </TabsContent>

            <TabsContent value="splitter" className="space-y-4 sm:space-y-6">
              {!user ? (
                <Card className="border-2">
                  <CardContent className="pt-4 sm:pt-6 text-center px-3 sm:px-6">
                    <Lock className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                    <h3 className="text-base sm:text-lg font-semibold mb-2">Sign in Required</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                      Please sign in to access the audio splitter feature
                    </p>
                    <Button onClick={() => navigate("/auth")} size="sm" className="sm:size-default">Sign In</Button>
                  </CardContent>
                </Card>
              ) : (
                <AudioSplitter />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      )}
    </div>
  );
};

export default Index;
