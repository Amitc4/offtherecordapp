/**
 * @file usePerfectRecords.ts — Returns the set of `record_id`s belonging to
 * the current user that have at least one AI grading with a perfect score (10.0).
 *
 * Used by collection views to overlay a small yellow star on the album cover
 * of records that achieved a flawless condition score.
 *
 * Note: RLS on `grading_history` restricts SELECT to the row owner, so this
 * hook only reflects the signed-in user's own gradings.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const usePerfectRecords = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["perfect-records", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("grading_history")
        .select("record_id, score")
        .eq("user_id", user!.id)
        .eq("score", 10);
      if (error) return new Set();
      return new Set(
        (data || [])
          .map((r: any) => r.record_id)
          .filter((id: string | null): id is string => !!id)
      );
    },
  });
};
