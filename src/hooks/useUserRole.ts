import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "user" | "premium" | "admin" | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUserRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkUserRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
        setRole("user");
      } else {
        setRole(data?.role as UserRole || "user");
      }
    } catch (error) {
      console.error("Error in checkUserRole:", error);
      setRole("user");
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = role === "premium" || role === "admin";
  const isAdmin = role === "admin";

  return { role, isLoading, isPremium, isAdmin, refetch: checkUserRole };
}
