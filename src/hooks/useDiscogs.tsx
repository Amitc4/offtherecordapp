/**
 * @file useDiscogs.tsx — Hooks for Discogs integration and local record/wishlist queries.
 *
 * This file contains multiple exported hooks:
 *
 * ### `useDiscogsProfile()`
 * Fetches the current user's profile row from the `profiles` table.
 * Used everywhere to check Discogs connection status, display name, etc.
 *
 * ### `useDiscogsConnect()`
 * Manages the OAuth 1.0a flow for linking a Discogs account:
 * 1. `startConnect(callbackUrl)` – Gets a request token from the Discogs edge function
 *    and returns the authorization URL the user should be redirected to.
 * 2. `completeConnect(oauthToken, oauthVerifier)` – Exchanges the verifier for an
 *    access token and saves it server-side.
 *
 * ### `useDiscogsSync()`
 * Provides mutations to sync data from Discogs:
 * - `syncCollection` – Imports the user's Discogs collection into `user_records`.
 * - `syncWishlist`   – Imports the user's Discogs wantlist into `user_wishlist`.
 * - `disconnect`     – Removes the Discogs OAuth tokens and resets the connection flag.
 *
 * ### `useUserRecords()`
 * Fetches all records owned by the current user from `user_records`, sorted newest-first.
 *
 * ### `useUserWishlist()`
 * Fetches all wishlist items owned by the current user from `user_wishlist`, sorted newest-first.
 *
 * All hooks communicate with the `discogs` edge function via authenticated fetch calls.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/** Base URL for the Discogs edge function. */
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discogs`;

function getHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function useDiscogsProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useDiscogsConnect() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [oauthSecret, setOauthSecret] = useState<string | null>(null);

  const startConnect = async (callbackUrl: string) => {
    const resp = await fetch(
      `${FUNCTIONS_URL}?action=request_token&callback_url=${encodeURIComponent(callbackUrl)}`,
      { headers: getHeaders(session!.access_token) }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    setOauthSecret(data.oauth_token_secret);
    return data;
  };

  const completeConnect = async (oauthToken: string, oauthVerifier: string) => {
    if (!oauthSecret) throw new Error("OAuth secret not found. Please start connection again.");
    const resp = await fetch(
      `${FUNCTIONS_URL}?action=access_token&oauth_token=${oauthToken}&oauth_token_secret=${oauthSecret}&oauth_verifier=${oauthVerifier}`,
      { headers: getHeaders(session!.access_token) }
    );
    const data = await resp.json();
    if (data.error) throw new Error(data.error);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    return data;
  };

  return { startConnect, completeConnect, oauthSecret, setOauthSecret };
}

export function useDiscogsSync() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const syncCollection = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${FUNCTIONS_URL}?action=sync_collection`, {
        headers: getHeaders(session!.access_token),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.count} records from Discogs`);
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncWishlist = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${FUNCTIONS_URL}?action=sync_wishlist`, {
        headers: getHeaders(session!.access_token),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.count} wishlist items from Discogs`);
      queryClient.invalidateQueries({ queryKey: ["user_wishlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${FUNCTIONS_URL}?action=disconnect`, {
        headers: getHeaders(session!.access_token),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Disconnected from Discogs");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user_records"] });
      queryClient.invalidateQueries({ queryKey: ["user_wishlist"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { syncCollection, syncWishlist, disconnect };
}

export function useUserRecords() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_records", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_records")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUserWishlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_wishlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_wishlist")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}
