import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Users, Key, Settings, BarChart3, FileText, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDetections: 0,
  });

  useEffect(() => {
    checkUser();
    fetchStats();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUser(user);
  };

  const fetchStats = async () => {
    try {
      // Get total detections
      const { count: detectionsCount } = await supabase
        .from('detection_history')
        .select('*', { count: 'exact', head: true });

      // Get total profiles
      const { count: profilesCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers: profilesCount || 0,
        totalDetections: detectionsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const adminTools = [
    {
      title: 'Database',
      description: 'Manage tables, view data, and run queries',
      icon: Database,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      info: 'Access via Lovable Cloud → Database tab'
    },
    {
      title: 'Users & Auth',
      description: 'Manage users, authentication providers, and sessions',
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      info: 'Access via Lovable Cloud → Users tab'
    },
    {
      title: 'Secrets',
      description: 'Manage API keys and environment variables',
      icon: Key,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      info: 'Access via Lovable Cloud → Secrets tab'
    },
    {
      title: 'Edge Functions',
      description: 'View and monitor serverless functions',
      icon: FileText,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      info: 'Access via Lovable Cloud → Edge Functions tab'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Manage your application backend and settings</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Registered accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalDetections}</div>
              <p className="text-xs text-muted-foreground">Songs identified</p>
            </CardContent>
          </Card>
        </div>

        {/* Backend Access Info */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Access Backend
            </CardTitle>
            <CardDescription>
              Manage your application's backend through Lovable Cloud
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              To access the full backend management interface:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground mb-4">
              <li><strong>Desktop:</strong> Click the "Cloud" button in the top navigation bar</li>
              <li><strong>Mobile:</strong> Tap the "Widgets" icon → "Cloud"</li>
              <li>Navigate to the specific tab (Database, Users, Secrets, etc.)</li>
            </ol>
            <Button 
              onClick={() => {
                toast({
                  title: "Backend Access",
                  description: "Click the 'Cloud' button in your Lovable editor to access backend management.",
                });
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              How to Access
            </Button>
          </CardContent>
        </Card>

        {/* Admin Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminTools.map((tool) => (
            <Card key={tool.title} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${tool.bgColor}`}>
                    <tool.icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-1">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">{tool.info}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/dashboard')}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics Dashboard
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                toast({
                  title: "User Management",
                  description: "Access Users tab in Lovable Cloud to manage user accounts.",
                });
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                toast({
                  title: "Database Access",
                  description: "Access Database tab in Lovable Cloud to view and manage data.",
                });
              }}
            >
              <Database className="h-4 w-4 mr-2" />
              View Database
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
