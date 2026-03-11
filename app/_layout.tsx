import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { getApiBaseUrl, getApiBaseUrlAsync } from "@/constants/oauth";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { DataProvider } from "@/lib/data-provider";
import { configureNotifications } from "@/lib/notification-manager";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// Keep native splash visible until we explicitly hide it (avoids blank screen or stuck splash)
if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync();
}

const needsAsyncBaseUrl = Platform.OS !== "web" && !getApiBaseUrl();

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [baseUrlResolved, setBaseUrlResolved] = useState(!needsAsyncBaseUrl);

  // Create tRPC client once when base URL is available (immediate on web/Expo Go, after getApiBaseUrlAsync() on prebuild)
  const trpcClient = useMemo(() => {
    if (!baseUrlResolved) return null;
    if (needsAsyncBaseUrl && !getApiBaseUrl()) return null;
    return createTRPCClient();
  }, [baseUrlResolved]);

  useEffect(() => {
    initManusRuntime();
    if (Platform.OS !== "web") {
      configureNotifications();
    }
  }, []);

  // Prebuild (no debuggerHost): resolve API base URL from device IP, then set flag so useMemo creates client
  useEffect(() => {
    if (!needsAsyncBaseUrl) return;
    getApiBaseUrlAsync().then(() => setBaseUrlResolved(true));
  }, []);

  // Hide splash only when we're about to show content (have a client), or after 8s safety
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (trpcClient != null) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 8000);
    return () => clearTimeout(t);
  }, [trpcClient]);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  if (trpcClient == null) {
    return null;
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <DataProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="weekly-summary" options={{ presentation: "card" }} />
              <Stack.Screen name="oauth/callback" />
            </Stack>
            <StatusBar style="auto" />
          </DataProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
