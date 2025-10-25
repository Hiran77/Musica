import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Music, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedSong, setDetectedSong] = useState<{
    title: string;
    artist: string;
    album?: string;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDetectedSong(null);
      
      toast({
        title: "Recording started",
        description: "Recording for 15 seconds...",
      });

      // Auto-stop after 15 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecording();
        }
      }, 15000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Error",
        description: "Could not access microphone. Please grant permission.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
          toast({
            title: "Song detected!",
            description: `${data.song.title} by ${data.song.artist}`,
          });
        } else {
          setDetectedSong(null);
          toast({
            title: "No match found",
            description: "Could not identify the song. Try again with clearer audio.",
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="container mx-auto max-w-2xl pt-8">
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Music className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight">Music Detector</h1>
          <p className="text-lg text-muted-foreground">
            Detect background music even with dialogue
          </p>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>
              Our AI separates music from speech and identifies songs playing in the background
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4">
              <Button
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className="h-16 text-lg"
              >
                {isRecording ? (
                  <>
                    <Mic className="mr-2 h-6 w-6 animate-pulse" />
                    Stop Recording
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                <li>• Record for at least 10-15 seconds</li>
                <li>• Works with TV shows, movies, YouTube, and live music</li>
                <li>• Can detect music even with dialogue playing</li>
                <li>• Ensure your device volume is audible</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
