import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  locationsQueryKey,
  readLocationSettings,
  readNearbyFriendsConfig,
  uploadLocation,
} from '../../api/friends';
import { getBrowserPosition } from '../../api/browser-position';
import { getApiErrorMessage } from '../../api/http';
import { getAuthSessionEpoch, useAuthStore } from '../../stores/auth.store';
import type { LocationDto, LocationSettingsDto, NearbyFriendsConfigDto } from '../../api/friends';

type LocationContextValue = {
  settings: LocationSettingsDto | undefined;
  config: NearbyFriendsConfigDto | undefined;
  settingsError: boolean;
  location: LocationDto | null;
  error: string | null;
  collecting: boolean;
  uploaded: boolean;
  refresh: () => Promise<void>;
};

const PERMISSION_DENIED_MESSAGE = '定位权限未开启，请在系统隐私设置中允许应用使用位置后重试。';

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((state) => state.currentUser?.id);
  const settingsQuery = useQuery({
    queryKey: [...locationsQueryKey, 'settings', userId],
    queryFn: readLocationSettings,
    enabled: Boolean(userId),
  });
  const settings = settingsQuery.data;
  const configQuery = useQuery({
    queryKey: [...locationsQueryKey, 'config'],
    queryFn: readNearbyFriendsConfig,
  });
  const config = configQuery.data;
  const [location, setLocation] = useState<LocationDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const inFlight = useRef(false);
  const permissionDenied = useRef(false);
  const activeRun = useRef<AbortController | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const configRef = useRef(config);
  configRef.current = config;

  const capture = useCallback(async (manual = false) => {
    const current = settingsRef.current;
    const policy = configRef.current;
    if (
      !current?.locationEnabled ||
      !policy ||
      inFlight.current ||
      document.visibilityState === 'hidden' ||
      (!manual && permissionDenied.current)
    )
      return;

    inFlight.current = true;
    permissionDenied.current = false;
    const controller = new AbortController();
    activeRun.current = controller;
    const epoch = getAuthSessionEpoch();
    const valid = () =>
      !controller.signal.aborted &&
      epoch === getAuthSessionEpoch() &&
      settingsRef.current?.locationEnabled;
    const startedAt = performance.now();
    setCollecting(true);

    let collectedLocation: LocationDto | null = null;
    try {
      // 先拿权限：需要时这里会弹出系统授权框，并等用户做出选择。
      const granted = await window.locationControl.requestAccess();
      if (!valid()) return;
      if (!granted) {
        permissionDenied.current = true;
        setError(PERMISSION_DENIED_MESSAGE);
        return;
      }

      // 再获取定位。
      const position = await getBrowserPosition(controller.signal);
      if (!valid()) return;

      const body = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      };
      collectedLocation = {
        ...body,
        expiresAt: new Date(position.timestamp + policy.location.ttlMs).toISOString(),
      };
      const saved = await uploadLocation(body, controller.signal);
      if (!valid()) return;

      setLocation(saved);
      setUploaded(true);
      setError(null);
    } catch (caught) {
      if (!valid()) return;

      if (collectedLocation) {
        setLocation(collectedLocation);
        setUploaded(false);
      }

      if (typeof caught === 'object' && caught !== null && 'code' in caught && caught.code === 1) {
        permissionDenied.current = true;
        setError(PERMISSION_DENIED_MESSAGE);
      } else {
        const message =
          typeof caught === 'object' && caught !== null && 'code' in caught
            ? caught.code === 3
              ? '定位超时，请检查系统定位服务与网络连接后重试。'
              : '暂时无法获取位置，请检查系统定位服务和网络连接后重试。'
            : await getApiErrorMessage(caught);
        setError(message);
      }
    } finally {
      if (manual && valid()) {
        const remaining = 400 - (performance.now() - startedAt);
        if (remaining > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
        }
      }
      inFlight.current = false;
      if (activeRun.current === controller) {
        activeRun.current = null;
        if (epoch === getAuthSessionEpoch()) setCollecting(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!settings?.locationEnabled || !config) {
      activeRun.current?.abort();
      setLocation(null);
      setUploaded(false);
      setCollecting(false);
      void window.locationControl.revokeAccess().catch(() => undefined);
      return;
    }

    permissionDenied.current = false;

    const startupTimer = window.setTimeout(() => void capture(), 0);
    const timer = window.setInterval(() => void capture(), config.location.refreshIntervalMs);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void capture();
      else activeRun.current?.abort();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      activeRun.current?.abort();
      void window.locationControl.revokeAccess().catch(() => undefined);
    };
  }, [capture, config, settings?.locationEnabled, userId]);

  return (
    <LocationContext.Provider
      value={{
        settings,
        config,
        settingsError: settingsQuery.isError || configQuery.isError,
        location,
        error,
        collecting,
        uploaded,
        refresh: () => capture(true),
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationStatus(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error('LocationProvider is missing.');
  return context;
}
