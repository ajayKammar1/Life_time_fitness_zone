import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";

import { initializeDatabase } from "@/lib/database";
import {
  addMembershipNotificationResponseListener,
  initializeMembershipNotifications,
  syncMembershipNotifications,
} from "@/lib/membershipNotifications";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  useEffect(() => {
    const prepareApp = async () => {
      try {
        initializeDatabase();
      } catch (error) {
        setInitializationError(error instanceof Error ? error.message : String(error));
      } finally {
        await SplashScreen.hideAsync();
        setIsReady(true);
      }
    };

    void prepareApp();
  }, []);

  useEffect(() => {
    if (!isReady || initializationError || Platform.OS === "web") return;

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncMembershipNotifications().catch((error: unknown) => {
          console.error("Unable to refresh membership reminders:", error);
        });
      }
    });

    let isMounted = true;
    let notificationSubscription: { remove: () => void } | undefined;

    const setupNotifications = async () => {
      try {
        const notificationsEnabled = await initializeMembershipNotifications();
        if (!isMounted || !notificationsEnabled) return;

        const subscription = await addMembershipNotificationResponseListener((data) => {
          if (!data || data.scope !== "gym-membership") return;

          if (data.route === "member-details" && typeof data.memberId === "string") {
            router.push({
              pathname: "/member-details",
              params: { memberId: data.memberId },
            } as any);
          } else {
            router.push("/members" as any);
          }
        });
        if (subscription && typeof subscription.remove === "function") {
          notificationSubscription = { remove: subscription.remove };
        }
      } catch (error) {
        console.error("Membership notifications are unavailable in this app build:", error);
      }
    };

    void setupNotifications();

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      if (typeof notificationSubscription?.remove === "function") {
        notificationSubscription.remove();
      }
    };
  }, [isReady, initializationError]);

  if (!isReady) return null;

  if (initializationError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to start GymApp</Text>
        <Text style={styles.errorMessage}>{initializationError}</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        animation: "fade",
        headerShown: false,
      }}
    />
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#0B0B0D",
  },
  errorTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  errorMessage: {
    color: "#EF4444",
    fontSize: 14,
  },
});
