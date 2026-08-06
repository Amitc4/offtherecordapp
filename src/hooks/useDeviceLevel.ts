/**
 * @file useDeviceLevel.ts — Device-tilt ("is the phone flat?") sensor hook.
 *
 * Reads `deviceorientation` and reports whether the phone is held flat and
 * parallel to the ground (i.e. parallel to a record lying on a table).
 *
 * - `beta`  = front-to-back tilt, `gamma` = left-to-right tilt. Both must be
 *   within ±`LEVEL_TOLERANCE_DEG` of 0 for the device to count as level.
 * - Readings are low-pass filtered and the level/not-level state must hold for
 *   `HOLD_MS` before it flips, so the UI does not flicker on small hand shake.
 * - iOS 13+ requires `DeviceOrientationEvent.requestPermission()` from a user
 *   gesture over HTTPS; call `requestPermission()` when the camera opens.
 * - When sensors are missing or permission is denied, `supported` is false and
 *   callers must NOT gate the shutter (see `levelVerified`).
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** Max allowed front-to-back / left-to-right tilt, in degrees, to count as flat. */
export const LEVEL_TOLERANCE_DEG = 5;

/** Low-pass smoothing factor for raw sensor readings (0..1, higher = snappier). */
const SMOOTHING = 0.25;
/** How long a new state must hold before the reported value flips. */
const HOLD_MS = 350;

export type LevelPermission = "unknown" | "granted" | "denied" | "unavailable";

export interface DeviceLevelState {
  /** True when sensors are available and delivering readings. */
  supported: boolean;
  /** Debounced levelness. Meaningless when `supported` is false. */
  isLevel: boolean;
  /** Smoothed tilt readings (degrees), for debugging / fine feedback. */
  beta: number;
  gamma: number;
  permission: LevelPermission;
  /** Whether levelness could actually be verified for this capture. */
  levelVerified: boolean;
  /** Requests iOS motion permission. Safe to call on other platforms. */
  requestPermission: () => Promise<LevelPermission>;
}

export const useDeviceLevel = (active: boolean): DeviceLevelState => {
  const [permission, setPermission] = useState<LevelPermission>("unknown");
  const [supported, setSupported] = useState(false);
  const [isLevel, setIsLevel] = useState(false);
  const [tilt, setTilt] = useState({ beta: 0, gamma: 0 });

  const smoothed = useRef<{ beta: number; gamma: number } | null>(null);
  const candidate = useRef<{ value: boolean; since: number } | null>(null);
  const levelRef = useRef(false);

  const requestPermission = useCallback(async (): Promise<LevelPermission> => {
    const Ctor = (window as any).DeviceOrientationEvent;
    if (!Ctor) {
      setPermission("unavailable");
      return "unavailable";
    }
    if (typeof Ctor.requestPermission === "function") {
      try {
        const res = await Ctor.requestPermission();
        const next: LevelPermission = res === "granted" ? "granted" : "denied";
        setPermission(next);
        return next;
      } catch {
        setPermission("denied");
        return "denied";
      }
    }
    setPermission("granted");
    return "granted";
  }, []);

  useEffect(() => {
    if (!active) {
      smoothed.current = null;
      candidate.current = null;
      levelRef.current = false;
      setSupported(false);
      setIsLevel(false);
      return;
    }
    if (permission === "denied" || permission === "unavailable") return;
    if (!(window as any).DeviceOrientationEvent) {
      setPermission("unavailable");
      return;
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null && e.gamma === null) return;
      const rawBeta = e.beta ?? 0;
      const rawGamma = e.gamma ?? 0;

      const prev = smoothed.current;
      const next = prev
        ? {
            beta: prev.beta + (rawBeta - prev.beta) * SMOOTHING,
            gamma: prev.gamma + (rawGamma - prev.gamma) * SMOOTHING,
          }
        : { beta: rawBeta, gamma: rawGamma };
      smoothed.current = next;
      setSupported(true);
      setTilt(next);

      const flat =
        Math.abs(next.beta) <= LEVEL_TOLERANCE_DEG && Math.abs(next.gamma) <= LEVEL_TOLERANCE_DEG;

      if (flat === levelRef.current) {
        candidate.current = null;
        return;
      }
      const now = Date.now();
      if (!candidate.current || candidate.current.value !== flat) {
        candidate.current = { value: flat, since: now };
        return;
      }
      if (now - candidate.current.since >= HOLD_MS) {
        levelRef.current = flat;
        candidate.current = null;
        setIsLevel(flat);
      }
    };

    window.addEventListener("deviceorientation", onOrientation, true);

    // If no reading arrives shortly, treat the device as sensor-less.
    const timer = setTimeout(() => {
      if (!smoothed.current) setPermission((p) => (p === "unknown" || p === "granted" ? "unavailable" : p));
    }, 2500);

    return () => {
      window.removeEventListener("deviceorientation", onOrientation, true);
      clearTimeout(timer);
    };
  }, [active, permission]);

  return {
    supported,
    isLevel,
    beta: tilt.beta,
    gamma: tilt.gamma,
    permission,
    levelVerified: supported && permission !== "denied" && permission !== "unavailable",
    requestPermission,
  };
};
