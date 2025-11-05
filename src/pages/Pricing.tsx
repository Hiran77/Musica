import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Zap, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const Pricing = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [usage, setUsage] = useState({ total: 0, thisMonth: 0 });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
    await fetchUsage(user.id);
  };

  const fetchUsage = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("audio_splits")
        .select("*")
        .eq("user_id", uid);

      if (error) throw error;

      const total = data?.length || 0;
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const thisMonth = data?.filter(split => 
        new Date(split.created_at) >= firstDayOfMonth
      ).length || 0;

      setUsage({ total, thisMonth });
    } catch (error) {
      console.error("Error fetching usage:", error);
      toast({
        title: "Error loading usage",
        description: "Failed to load your usage statistics",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Credits & Pricing
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Track your usage and understand the costs of our audio splitting service
          </p>
        </div>

        {/* Usage Stats */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                This Month
              </CardTitle>
              <CardDescription>Splits completed in current month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {isLoading ? "..." : usage.thisMonth}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Total Splits
              </CardTitle>
              <CardDescription>All-time splits processed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">
                {isLoading ? "..." : usage.total}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pricing Information */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">How Pricing Works</CardTitle>
              <CardDescription>
                Our audio splitting service uses Replicate's AI models
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Cost Structure</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Pay-per-use:</strong> You only pay for what you process
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Powered by Replicate:</strong> Industry-leading AI model (Demucs)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">High quality:</strong> Professional-grade audio separation
                    </span>
                  </li>
                </ul>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-3">Getting Started</h3>
                <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    To use the audio splitting service, you'll need to set up billing on your Replicate account:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                    <li>Create an account at <a href="https://replicate.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">replicate.com</a></li>
                    <li>Add billing information in your account settings</li>
                    <li>Generate an API key and configure it in our system</li>
                    <li>Start processing audio with usage-based pricing</li>
                  </ol>
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => window.open("https://replicate.com/account/billing", "_blank")}
                  >
                    Set Up Billing on Replicate
                  </Button>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-semibold mb-3">Features Included</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Vocals</Badge>
                    <span className="text-sm text-muted-foreground">Track separation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Drums</Badge>
                    <span className="text-sm text-muted-foreground">Track separation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Bass</Badge>
                    <span className="text-sm text-muted-foreground">Track separation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Other</Badge>
                    <span className="text-sm text-muted-foreground">Track separation</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
