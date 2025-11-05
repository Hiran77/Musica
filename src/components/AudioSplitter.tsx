import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Music, Mic, Guitar, Piano, Disc, Upload, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SPLIT_TYPES = {
  basic: [
    { id: "vocals", label: "Vocals / Voice / Dialogue", icon: Mic },
    { id: "accompaniment", label: "Music / Song / Tune", icon: Music },
  ],
  instruments: [
    { id: "guitar", label: "Guitar", icon: Guitar },
    { id: "piano", label: "Piano", icon: Piano },
    { id: "bass", label: "Bass", icon: Disc },
    { id: "drums", label: "Drums", icon: Disc },
    { id: "violin", label: "Violin", icon: Music },
    { id: "saxophone", label: "Saxophone", icon: Music },
    { id: "trumpet", label: "Trumpet", icon: Music },
    { id: "flute", label: "Flute", icon: Music },
  ],
};

export function AudioSplitter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [splitType, setSplitType] = useState<string>("two-stems");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("audio/")) {
        setSelectedFile(file);
        setResults(null);
      } else {
        toast({
          title: "Invalid file",
          description: "Please select an audio file",
          variant: "destructive",
        });
      }
    }
  };

  const handleSplit = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select an audio file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to use audio splitting",
          variant: "destructive",
        });
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke("split-audio", {
        body: {
          audio: base64Audio,
          filename: selectedFile.name,
          splitType: splitType,
          instrument: selectedInstrument,
        },
      });

      if (error) throw error;

      setResults(data);
      
      toast({
        title: "Audio split successfully!",
        description: "Your audio has been processed",
      });
    } catch (error: any) {
      console.error("Error splitting audio:", error);
      
      // Handle specific error cases
      let errorTitle = "Split failed";
      let errorDescription = error.message || "Failed to split audio";
      
      if (error.message?.includes("Payment required")) {
        errorTitle = "Payment Required";
        errorDescription = "The audio splitting service requires billing to be set up. Please configure billing at your Replicate account.";
      }
      
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Audio</CardTitle>
          <CardDescription>
            Upload an audio file to split into vocals and music or individual instruments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label
              htmlFor="audio-upload"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Choose Audio File
            </Label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile && (
              <span className="text-sm text-muted-foreground">{selectedFile.name}</span>
            )}
          </div>

          <div className="space-y-2">
            <Label>Split Type</Label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="two-stems">Vocals & Music (2 tracks)</SelectItem>
                <SelectItem value="four-stems">Vocals, Drums, Bass & Other (4 tracks)</SelectItem>
                <SelectItem value="instrument">Specific Instrument</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {splitType === "instrument" && (
            <div className="space-y-2">
              <Label>Select Instrument</Label>
              <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose instrument..." />
                </SelectTrigger>
                <SelectContent>
                  {SPLIT_TYPES.instruments.map((instrument) => (
                    <SelectItem key={instrument.id} value={instrument.id}>
                      {instrument.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleSplit}
            disabled={!selectedFile || isProcessing || (splitType === "instrument" && !selectedInstrument)}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Music className="mr-2 h-4 w-4" />
                Split Audio
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Split Results</CardTitle>
            <CardDescription>Download your separated audio tracks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SPLIT_TYPES.basic.map((type) => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    className="p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className="h-5 w-5 text-primary" />
                      <h3 className="font-medium">{type.label}</h3>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Processing complete! Your tracks are ready to download.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
