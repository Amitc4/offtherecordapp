/**
 * @file useLocation.tsx — Browser geolocation hook + Haversine distance utility.
 *
 * ### `useLocation()` hook
 * Returns the user's current GPS coordinates and a function to request them.
 * When permission is granted the coordinates are also persisted to the
 * user's `profiles` row so that other users can calculate distance.
 *
 * Returned state:
 * - `latitude` / `longitude` – Current coords (null until granted).
 * - `loading` – True while waiting for the browser geolocation API.
 * - `error` – Human-readable error message if denied/unavailable.
 * - `permissionGranted` – Whether the user has approved location access.
 * - `requestLocation()` – Call this to trigger the browser permission prompt.
 *
 * ### `getDistanceKm(lat1, lon1, lat2, lon2)`
 * Pure function that calculates the great-circle distance between two
 * points using the **Haversine formula**. Returns distance in kilometers.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

/** Internal state shape for the location hook. */
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

  /**
   * Triggers the browser's geolocation permission prompt.
   * On success, saves coordinates to React state **and** to the user's profile row.
   */
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

        // Persist to the user's profile so other users can compute distance
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

/**
 * Calculates the distance (in km) between two lat/lon points using the
 * Haversine formula.
 *
 * @param lat1 - Latitude of point A (degrees)
 * @param lon1 - Longitude of point A (degrees)
 * @param lat2 - Latitude of point B (degrees)
 * @param lon2 - Longitude of point B (degrees)
 * @returns Distance in kilometres
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
