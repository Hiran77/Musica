import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Music, TrendingUp, User, History, LogOut, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserStats {
  total_detections: number;
  unique_songs: number;
  unique_artists: number;
  favorite_artist: string | null;
}

interface RecentDetection {
  id: string;
  song_title: string;
  artist: string;
  detected_at: string;
  cover_url: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentDetections, setRecentDetections] = useState<RecentDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/auth');
      return;
    }

    setUser(user);
    await loadUserData(user.id);
  };

  const loadUserData = async (userId: string) => {
    try {
      // Load stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      setStats(statsData || {
        total_detections: 0,
        unique_songs: 0,
        unique_artists: 0,
        favorite_artist: null
      });

      // Load recent detections
      const { data: detectionsData, error: detectionsError } = await supabase
        .from('detection_history')
        .select('*')
        .eq('user_id', userId)
        .order('detected_at', { ascending: false })
        .limit(10);

      if (detectionsError) throw detectionsError;

      setRecentDetections(detectionsData || []);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-gray-400">Welcome back, {user?.email?.split('@')[0]}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-green-500/30"
            >
              <Home className="w-4 h-4 mr-2" />
              Detect Music
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 bg-gray-900/50 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Detections</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats?.total_detections || 0}
                </p>
              </div>
              <Music className="w-8 h-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gray-900/50 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Unique Songs</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats?.unique_songs || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-emerald-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gray-900/50 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Unique Artists</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats?.unique_artists || 0}
                </p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gray-900/50 border-green-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Favorite Artist</p>
                <p className="text-lg font-bold text-white mt-1 truncate">
                  {stats?.favorite_artist || 'N/A'}
                </p>
              </div>
              <History className="w-8 h-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Recent Detections */}
        <Card className="p-6 bg-gray-900/50 border-green-500/20">
          <h2 className="text-xl font-bold text-white mb-4">Recent Detections</h2>
          
          {recentDetections.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No detections yet. Start detecting music!</p>
              <Button
                onClick={() => navigate('/')}
                className="mt-4 bg-gradient-to-r from-green-500 to-emerald-500"
              >
                Start Detecting
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDetections.map((detection) => (
                <div
                  key={detection.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
                >
                  {detection.cover_url ? (
                    <img
                      src={detection.cover_url}
                      alt={detection.song_title}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <Music className="w-6 h-6 text-white" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{detection.song_title}</p>
                    <p className="text-gray-400 text-sm truncate">{detection.artist}</p>
                  </div>
                  
                  <p className="text-gray-500 text-sm whitespace-nowrap">
                    {new Date(detection.detected_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
