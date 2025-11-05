import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User, Crown, Bell, Palette, Music2, Shield } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const { role, isPremium, isLoading } = useUserRole();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [theme, setTheme] = useState("system");
  const [defaultSplitType, setDefaultSplitType] = useState("two-stems");

  useEffect(() => {
    checkUser();
    loadProfile();
    loadPreferences();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
  };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      setUsername(data.username || "");
    }
  };

  const loadPreferences = () => {
    // Load from localStorage for now
    const savedTheme = localStorage.getItem("theme") || "system";
    const savedNotifications = localStorage.getItem("emailNotifications") !== "false";
    const savedSplitType = localStorage.getItem("defaultSplitType") || "two-stems";
    
    setTheme(savedTheme);
    setEmailNotifications(savedNotifications);
    setDefaultSplitType(savedSplitType);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          username,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Profile updated successfully");
      loadProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = () => {
    localStorage.setItem("theme", theme);
    localStorage.setItem("emailNotifications", emailNotifications.toString());
    localStorage.setItem("defaultSplitType", defaultSplitType);
    
    toast.success("Preferences saved successfully");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-2">
              <Palette className="h-4 w-4" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="premium" className="gap-2">
              <Crown className="h-4 w-4" />
              Premium
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                  />
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium">Current Role:</span>
                    <span className="px-2 py-1 rounded-md bg-accent text-accent-foreground text-xs font-medium uppercase">
                      {role}
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
                <CardDescription>Customize your experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor="notifications" className="font-medium">
                        Email Notifications
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Receive updates about your audio splits
                    </p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme" className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Theme
                  </Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger id="theme">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="split-type" className="flex items-center gap-2">
                    <Music2 className="h-4 w-4 text-muted-foreground" />
                    Default Split Type
                  </Label>
                  <Select value={defaultSplitType} onValueChange={setDefaultSplitType}>
                    <SelectTrigger id="split-type">
                      <SelectValue placeholder="Select default split" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="two-stems">Two Stems (Vocals/Music)</SelectItem>
                      <SelectItem value="four-stems">Four Stems (All)</SelectItem>
                      <SelectItem value="instrument">Instrument Specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSavePreferences} className="w-full">
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Premium Tab */}
          <TabsContent value="premium" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Premium Membership
                </CardTitle>
                <CardDescription>
                  {isPremium
                    ? "You're currently enjoying premium features"
                    : "Upgrade to unlock advanced features"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isPremium ? (
                  <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Crown className="h-6 w-6 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">
                        Premium Active
                      </h3>
                    </div>
                    <p className="text-muted-foreground">
                      Thank you for being a premium member! You have access to all premium features.
                    </p>
                    <div className="space-y-2">
                      <h4 className="font-medium text-foreground">Premium Features:</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Unlimited audio splits
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Advanced instrument separation
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Higher quality audio processing
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Priority processing queue
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Extended history storage
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="rounded-lg border bg-card p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <Crown className="h-6 w-6 text-primary" />
                        <h3 className="text-lg font-semibold">Upgrade to Premium</h3>
                      </div>
                      <p className="text-muted-foreground">
                        Get access to advanced features and unlimited audio processing
                      </p>
                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Unlimited audio splits per month
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Advanced instrument separation options
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Higher quality processing (up to 320kbps)
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Priority processing queue
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Extended history (unlimited storage)
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          Early access to new features
                        </li>
                      </ul>
                      <div className="pt-4">
                        <div className="text-3xl font-bold text-foreground mb-1">
                          $9.99<span className="text-lg text-muted-foreground">/month</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Cancel anytime, no questions asked
                        </p>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => {
                            toast.info("Payment integration coming soon! We'll enable Stripe payments shortly.");
                          }}
                        >
                          <Crown className="h-4 w-4 mr-2" />
                          Upgrade Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
