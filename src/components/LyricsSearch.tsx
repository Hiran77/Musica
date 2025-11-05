import { useState } from "react";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SongResult {
  id: number;
  title: string;
  artist: string;
  artistImage: string;
  songArt: string;
  url: string;
}

export const LyricsSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      toast({
        title: "Enter lyrics",
        description: "Please enter some lyrics to search for",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("search-lyrics", {
        body: { query: query.trim() },
      });

      if (error) throw error;

      if (data.results && data.results.length > 0) {
        setResults(data.results);
        toast({
          title: "Songs found!",
          description: `Found ${data.results.length} matching songs`,
        });
      } else {
        setResults([]);
        toast({
          title: "No results",
          description: "Try different lyrics or check your spelling",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error searching lyrics:", error);
      toast({
        title: "Search failed",
        description: error.message || "Failed to search for lyrics",
        variant: "destructive",
      });
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 shadow-lg">
        <CardHeader>
          <CardTitle>Search by Lyrics</CardTitle>
          <CardDescription>
            Enter any lyrics you remember to find the song
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter lyrics... (e.g., 'cause baby now we got bad blood')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isSearching}
              className="flex-1"
            />
            <Button type="submit" disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Results ({results.length})</h3>
          <div className="grid gap-4">
            {results.map((song) => (
              <Card key={song.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {song.songArt && (
                      <img
                        src={song.songArt}
                        alt={song.title}
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-lg truncate">{song.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {song.artistImage && (
                          <img
                            src={song.artistImage}
                            alt={song.artist}
                            className="w-6 h-6 rounded-full"
                          />
                        )}
                        <p className="text-muted-foreground">{song.artist}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => window.open(song.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View on Genius
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
