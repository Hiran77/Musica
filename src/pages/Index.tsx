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

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const { isPremium, isLoading: roleLoading } = useUserRole();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [captureMode, setCaptureMode] = useState<"microphone" | "tab" | "system">("tab");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
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
    
    // Check if running on mobile
    const isNativePlatform = Capacitor.isNativePlatform();
    setIsMobile(isNativePlatform);
    if (isNativePlatform) {
      setCaptureMode("system");
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      <div className="p-4">
      <div className="container mx-auto max-w-2xl pt-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Music className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Musica</h1>
          <p className="text-lg text-muted-foreground">
            Detect music by sound or search by lyrics
          </p>
        </div>

        <Tabs defaultValue="detect" className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="detect">Audio Detection</TabsTrigger>
            <TabsTrigger value="lyrics">Lyrics Search</TabsTrigger>
            <TabsTrigger value="splitter">
              Audio Splitter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detect" className="space-y-6">
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>How it works</CardTitle>
                <CardDescription>
                  Our AI separates music from speech and identifies songs playing in the background
                </CardDescription>
              </CardHeader>
          <CardContent className="space-y-6">
            {isMobile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {captureMode === "system" ? (
                      <Speaker className="h-5 w-5 text-primary" />
                    ) : (
                      <Mic className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <Label className="text-base font-medium">
                        {captureMode === "system" ? "System Audio" : "Microphone"}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {captureMode === "system" 
                          ? "Detect audio playing on this device" 
                          : "Record from microphone"}
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={captureMode === "microphone"}
                    onCheckedChange={(checked) => setCaptureMode(checked ? "microphone" : "system")}
                  />
                </div>
              </div>
            ) : (
              <Tabs value={captureMode} onValueChange={(v) => setCaptureMode(v as "microphone" | "tab")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="tab" className="flex items-center gap-2">
                    <MonitorPlay className="h-4 w-4" />
                    Tab Audio
                  </TabsTrigger>
                  <TabsTrigger value="microphone" className="flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Microphone
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="tab" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Capture audio directly from YouTube, Spotify, or any browser tab
                  </p>
                </TabsContent>
                
                <TabsContent value="microphone" className="mt-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Record music playing near your device's microphone
                  </p>
                </TabsContent>
              </Tabs>
            )}

            <div className="flex flex-col gap-4">
              {isRecording && (
                <Card className="border-primary/50 bg-primary/5 animate-pulse">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <Radio className="h-8 w-8 text-primary animate-pulse" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">Listening...</h3>
                        <p className="text-2xl font-bold text-primary">{recordingDuration}s</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {recordingDuration < 10 
                            ? "Keep recording (min 10s recommended)" 
                            : "Recording... Will auto-stop when audio ends"}
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
                className="h-16 text-lg"
                variant={isRecording ? "destructive" : "default"}
              >
                {isRecording ? (
                  <>
                    <Mic className="mr-2 h-6 w-6" />
                    Stop Recording ({recordingDuration}s)
                  </>
                ) : isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mic className="mr-2 h-6 w-6" />
                    Start Recording
                  </>
                )}
              </Button>

              {detectedSong && (
                <>
                  {/* Success Banner */}
                  <Card className="border-green-500/50 bg-gradient-to-r from-green-500/10 to-emerald-500/10">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-green-500/20 p-2">
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">Song Identified!</h3>
                            <p className="text-sm text-muted-foreground">
                              {isSaved ? "Saved to your history" : user ? "Auto-saved to history" : "Sign in to save to history"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={handleRetry}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Retry
                          </Button>
                          {user && !isSaved && (
                            <Button
                              onClick={() => saveDetectionToHistory(detectedSong)}
                              variant="default"
                              size="sm"
                              className="gap-2"
                            >
                              <Heart className="h-4 w-4" />
                              Save
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detection Results */}
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{detectedSong.title}</h3>
                          <p className="text-muted-foreground">{detectedSong.artist}</p>
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
                        
                        <div className="mt-4 pt-4 border-t border-green-500/20">
                          <h4 className="text-sm font-semibold mb-3">Now Playing:</h4>
                          <div className="mb-4 rounded-lg overflow-hidden bg-black/5">
                            <iframe
                              width="100%"
                              height="200"
                              src={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).youtubeEmbed}
                              title="YouTube Music Player"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                              referrerPolicy="strict-origin-when-cross-origin"
                              className="w-full"
                            />
                          </div>
                          
                          <h4 className="text-sm font-semibold mb-3">Or listen on:</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30"
                              asChild
                            >
                              <a
                                href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).youtube}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Youtube className="h-4 w-4 text-red-500" />
                                YouTube
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 bg-green-500/10 border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30"
                              asChild
                            >
                              <a
                                href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).spotify}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Music2 className="h-4 w-4 text-green-500" />
                                Spotify
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 bg-pink-500/10 border-pink-500/20 hover:bg-pink-500/20 hover:border-pink-500/30"
                              asChild
                            >
                              <a
                                href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).appleMusic}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Apple className="h-4 w-4 text-pink-500" />
                                Apple Music
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30"
                              asChild
                            >
                              <a
                                href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).soundcloud}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Cloud className="h-4 w-4 text-orange-500" />
                                SoundCloud
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                              </a>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              className="justify-start gap-2 col-span-2 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30"
                              asChild
                            >
                              <a
                                href={getMusicPlatformUrls(detectedSong.title, detectedSong.artist).amazonMusic}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ShoppingCart className="h-4 w-4 text-blue-500" />
                                Amazon Music
                                <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
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
                <Card className="border-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-6 w-6 text-muted-foreground flex-shrink-0 mt-1" />
                      <div>
                        <p className="text-muted-foreground">
                          No song detected yet. Start recording to identify background music.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <h4 className="font-semibold mb-2">Tips for best results:</h4>
              <ul className="space-y-1 text-muted-foreground">
                {isMobile ? (
                  <>
                    <li>• <strong>System Audio:</strong> Detect music playing on your device</li>
                    <li>• <strong>Microphone:</strong> Position near speakers for best quality</li>
                    <li>• <strong>Duration:</strong> Record for 10-15s minimum, longer for difficult songs</li>
                    <li>• <strong>Background music:</strong> Record for 20-30s for scenes with dialogue</li>
                  </>
                ) : (
                  <>
                    <li>• <strong>Tab Audio:</strong> Select the tab playing music when prompted</li>
                    <li>• <strong>Microphone:</strong> Position near speakers for best quality</li>
                    <li>• <strong>Auto-stop:</strong> Recording stops automatically after 7s of silence</li>
                    <li>• <strong>Duration:</strong> Record for 10-15s minimum, longer for difficult songs</li>
                    <li>• <strong>Background music:</strong> Record for 20-30s for scenes with dialogue</li>
                    <li>• Works with YouTube, Spotify, movies, TV shows, and live music</li>
                  </>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="lyrics" className="space-y-6">
            <LyricsSearch />
          </TabsContent>

          <TabsContent value="splitter" className="space-y-6">
            {!user ? (
              <Card className="border-2">
                <CardContent className="pt-6 text-center">
                  <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Sign in Required</h3>
                  <p className="text-muted-foreground mb-4">
                    Please sign in to access the audio splitter feature
                  </p>
                  <Button onClick={() => navigate("/auth")}>Sign In</Button>
                </CardContent>
              </Card>
            ) : (
              <AudioSplitter />
            )}
          </TabsContent>
        </Tabs>

      </div>
      </div>
    </div>
  );
};

export default Index;
