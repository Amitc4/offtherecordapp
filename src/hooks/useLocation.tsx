import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

export function useLocation() {
  const { user } = useAuth();
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
    permissionGranted: false,
  });

  const requestLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: "Geolocation not supported" }));
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setState({ latitude, longitude, loading: false, error: null, permissionGranted: true });

        // Save to profile
        if (user) {
          await supabase
            .from("profiles")
            .update({ latitude, longitude } as any)
            .eq("user_id", user.id);
        }
      },
      (err) => {
        const msg = err.code === 1 ? "Location permission denied" : "Could not get location";
        setState((s) => ({ ...s, loading: false, error: msg }));
        toast.error(msg);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [user]);

  return { ...state, requestLocation };
}

// Haversine distance in km
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
