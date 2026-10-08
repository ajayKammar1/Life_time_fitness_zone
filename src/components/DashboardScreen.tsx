import { router, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/store/authStore";
import { getMembers } from "@/lib/memberRepository";
import { getDashboardStats } from "@/lib/memberService";
import { chooseBackup, createAndShareBackup, replaceMembersFromBackup, saveBackupToDevice } from "@/lib/backupService";
import { syncMembershipNotifications } from "@/lib/membershipNotifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

export default function DashboardScreen() {
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/" as any);
    }
  }, [isAuthenticated]);

  const [members, setMembers] = useState(() => (isAuthenticated ? getMembers() : []));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const stats = useMemo(() => getDashboardStats(members), [members]);

  const refreshMembers = useCallback(() => {
    if (isAuthenticated) {
      setMembers(getMembers());
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      refreshMembers();
    }, [refreshMembers]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMembers();
    setIsRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    router.replace("/" as any);
  };

  const handleCreateBackup = async () => {
    setIsBackupBusy(true);
    try {
      const count = await createAndShareBackup();
      Alert.alert("Backup ready", `Shared a backup containing ${count} member${count === 1 ? "" : "s"} and their profile photos.`);
    } catch (error) {
      Alert.alert("Backup failed", error instanceof Error ? error.message : String(error));
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleSaveBackup = async () => {
    setIsBackupBusy(true);
    try {
      const count = await saveBackupToDevice();
      if (count === null) return;
      Alert.alert("Backup saved", `Saved a backup containing ${count} member${count === 1 ? "" : "s"} and their profile photos.`);
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : String(error));
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleRestoreBackup = () => {
    setIsBackupMenuOpen(false);
    Alert.alert(
      "Restore from backup",
      "Choose a GymApp backup file. You will review its contents before it replaces the current member records and profile photos. Your admin login will be kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose Backup",
          onPress: () => {
            void (async () => {
              try {
                const backup = await chooseBackup();
                if (!backup) return;
                Alert.alert(
                  "Replace current member data?",
                  `This backup contains ${backup.members.length} member${backup.members.length === 1 ? "" : "s"}. All current member records and profile photos will be replaced. This cannot be undone.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Replace Data",
                      style: "destructive",
                      onPress: () => {
                        setIsBackupBusy(true);
                        void (async () => {
                          try {
                            const result = await replaceMembersFromBackup(backup);
                            refreshMembers();
                            void syncMembershipNotifications().catch((error: unknown) => {
                              console.error("Unable to refresh membership reminders after restore:", error);
                            });
                            Alert.alert(
                              result.cleanupWarning ? "Restore completed with a warning" : "Restore complete",
                              result.cleanupWarning ?? `Restored ${result.memberCount} member${result.memberCount === 1 ? "" : "s"} and their profile photos.`,
                            );
                          } catch (error) {
                            Alert.alert("Restore failed", error instanceof Error ? error.message : String(error));
                          } finally {
                            setIsBackupBusy(false);
                          }
                        })();
                      },
                    },
                  ],
                );
              } catch (error) {
                Alert.alert("Unable to read backup", error instanceof Error ? error.message : String(error));
              }
            })();
          },
        },
      ],
    );
  };

  const openMemberList = (filter: "All" | "Active" | "Expiring" | "Expired") => {
    router.push({ pathname: "/members", params: { filter } } as any);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#F5B700"
          colors={["#F5B700"]}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Welcome</Text>
      </View>

      <View style={styles.statsGrid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View all ${stats.total} members`}
          onPress={() => openMemberList("All")}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Total Members</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${stats.active} active members`}
          onPress={() => openMemberList("Active")}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Active</Text>
          <Text style={styles.statValue}>{stats.active}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${stats.expired} expired members`}
          onPress={() => openMemberList("Expired")}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Expired</Text>
          <Text style={styles.statValue}>{stats.expired}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${stats.expiringSoon} members expiring soon`}
          onPress={() => openMemberList("Expiring")}
          style={styles.statCard}
        >
          <Text style={styles.statLabel}>Expiring Soon</Text>
          <Text style={styles.statValue}>{stats.expiringSoon}</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push("/members" as any)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>View Members</Text>
      </Pressable>

      <Pressable onPress={() => router.push({ pathname: "/member-form", params: { mode: "create" } } as any)} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Add Member</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open backup and restore options"
        disabled={isBackupBusy}
        onPress={() => setIsBackupMenuOpen(true)}
        style={[styles.backupMenuButton, isBackupBusy && styles.disabledButton]}
      >
        {isBackupBusy ? (
          <ActivityIndicator color="#A7A7A7" size="small" />
        ) : (
          <Text style={styles.backupMenuButtonText}>Backup &amp; Restore</Text>
        )}
      </Pressable>

      <Modal
        visible={isBackupMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBackupMenuOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.backupMenu}>
            <Text style={styles.backupMenuTitle}>Backup &amp; Restore</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsBackupMenuOpen(false);
                void handleSaveBackup();
              }}
              style={styles.backupMenuOption}
            >
              <Text style={styles.backupMenuOptionText}>Save Backup to Device</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsBackupMenuOpen(false);
                void handleCreateBackup();
              }}
              style={styles.backupMenuOption}
            >
              <Text style={styles.backupMenuOptionText}>Share Backup</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleRestoreBackup}
              style={styles.backupMenuOption}
            >
              <Text style={styles.backupMenuOptionText}>Restore Data</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsBackupMenuOpen(false)}
              style={styles.backupMenuCancel}
            >
              <Text style={styles.backupMenuCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh dashboard"
          onPress={handleRefresh}
          style={styles.refreshButton}
        >
          {isRefreshing ? (
            <ActivityIndicator color="#FFD54A" size="small" />
          ) : (
            <Text style={styles.refreshText}>↻ Refresh</Text>
          )}
        </Pressable>
        <Pressable onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0B0B0D",
    padding: 24,
    paddingTop: 56,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 23,
  },
  logoutButton: {
    minWidth: 112,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.5)",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  refreshButton: {
    minWidth: 112,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.5)",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    lineHeight: 20,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: "auto",
    paddingTop: 28,
    paddingBottom: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#17171A",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.2)",
    marginBottom: 12,
  },
  statLabel: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  statValue: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 28,
  },
  primaryButton: {
    backgroundColor: "#F5B700",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#17171A",
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.4)",
  },
  secondaryButtonText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
  backupMenuButton: {
    alignSelf: "center",
    borderRadius: 10,
    minHeight: 34,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#303035",
    backgroundColor: "#141417",
    marginTop: 12,
  },
  backupMenuButtonText: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  backupMenu: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#17171A",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.24)",
  },
  backupMenuTitle: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    marginBottom: 12,
  },
  backupMenuOption: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#303035",
  },
  backupMenuOptionText: {
    color: "#D6D6D8",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
  },
  backupMenuCancel: {
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  backupMenuCancelText: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
