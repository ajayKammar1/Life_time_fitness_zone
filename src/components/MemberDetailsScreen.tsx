import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { getMemberById, deleteMember } from "@/lib/memberRepository";
import { formatMoney, getMembershipStatus } from "@/lib/memberService";
import { syncMembershipNotifications } from "@/lib/membershipNotifications";
import type { Member } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ScreenNavigation from "./ScreenNavigation";

export default function MemberDetailsScreen() {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();

  useEffect(() => {
    if (!memberId) {
      router.replace("/members" as any);
    }
  }, [memberId]);

  const member = useMemo<Member | null>(() => {
    const id = Number(memberId);
    if (!id) return null;
    return getMemberById(id);
  }, [memberId]);

  if (!member) {
    return (
      <View style={styles.emptyContainer}>
        <ScreenNavigation />
        <Text style={styles.emptyText}>Member not found</Text>
      </View>
    );
  }

  const status = getMembershipStatus(member.end_date);
  const imageUri = member.image_path ? `${FileSystem.documentDirectory ?? ""}${member.image_path}` : undefined;

  const handleDelete = () => {
    Alert.alert("Delete Member?", `Are you sure you want to delete ${member.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          deleteMember(member.id);
          try {
            await syncMembershipNotifications();
          } catch (error) {
            console.error("Member deleted, but membership reminders could not be updated:", error);
          }
          router.replace("/members" as any);
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenNavigation />
      <Text style={styles.eyebrow}>GYM MEMBER</Text>
      <Text style={styles.title}>Member Details</Text>

      <View style={styles.profileCard}>
        {imageUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${member.name}'s profile photo`}
            onPress={() => setIsImageOpen(true)}
          >
            <Image source={{ uri: imageUri }} style={styles.photo} />
          </Pressable>
        ) : (
          <View style={styles.placeholderPhoto}>
            <Text style={styles.placeholderText}>{member.name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{member.name}</Text>
          <Text style={styles.memberCode}>{member.member_code}</Text>
          <View style={[styles.statusBadge, status === "ACTIVE" ? styles.activeBadge : styles.expiredBadge]}>
            <Text style={[styles.statusText, status === "ACTIVE" ? styles.active : styles.expired]}>
              {status}
            </Text>
          </View>
        </View>
      </View>

      {imageUri ? (
        <Modal
          visible={isImageOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsImageOpen(false)}
          statusBarTranslucent
        >
          <Pressable style={styles.imageViewerBackdrop} onPress={() => setIsImageOpen(false)}>
            <Image source={{ uri: imageUri }} style={styles.fullSizeImage} resizeMode="contain" />
            <Text style={styles.imageViewerClose}>×</Text>
          </Pressable>
        </Modal>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>PLAN</Text>
          <Text style={styles.summaryValue}>{member.membership_plan}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>FEE</Text>
          <Text style={styles.summaryValue}>{formatMoney(member.amount ?? 0)}</Text>
        </View>
      </View>

      <DetailSection title="Contact">
        <DetailRow label="Mobile" value={member.phone} />
        <DetailRow label="Email" value={member.email} />
        <DetailRow label="Address" value={member.address} />
        <DetailRow label="Emergency contact" value={member.emergency_contact} last />
      </DetailSection>

      <DetailSection title="Physical profile">
        <View style={styles.metricsRow}>
          <Metric label="HEIGHT" value={member.height_cm ? `${member.height_cm} cm` : "-"} />
          <Metric label="WEIGHT" value={member.weight_kg ? `${member.weight_kg} kg` : "-"} />
          <Metric label="BLOOD" value={member.blood_group || "-"} />
        </View>
        <DetailRow label="Gender" value={member.gender} />
        <DetailRow label="Date of birth" value={member.date_of_birth} last />
      </DetailSection>

      <DetailSection title="Membership">
        <DetailRow label="Start date" value={member.start_date} />
        <DetailRow label="End date" value={member.end_date} last />
      </DetailSection>

      {member.notes ? (
        <DetailSection title="Notes">
          <Text style={styles.notes}>{member.notes}</Text>
        </DetailSection>
      ) : null}

      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => router.push({ pathname: "/member-form", params: { mode: "edit", memberId: String(member.id) } } as any)}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Edit Member</Text>
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Delete Member</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View style={[styles.detailRow, last && styles.lastDetailRow]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || "-"}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0B0B0D",
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 30,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: "#0B0B0D",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    marginBottom: 18,
  },
  eyebrow: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 28,
    marginBottom: 18,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#17171A",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.25)",
  },
  profileInfo: {
    flex: 1,
    alignItems: "flex-start",
  },
  photo: {
    width: 82,
    height: 82,
    borderRadius: 18,
    backgroundColor: "#0B0B0D",
  },
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  fullSizeImage: {
    width: "100%",
    height: "82%",
  },
  imageViewerClose: {
    position: "absolute",
    top: 48,
    right: 24,
    color: "#FFFFFF",
    fontSize: 38,
  },
  placeholderPhoto: {
    width: 82,
    height: 82,
    borderRadius: 18,
    backgroundColor: "#0B0B0D",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.25)",
  },
  placeholderText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 30,
  },
  name: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 20,
    flexShrink: 1,
  },
  memberCode: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 9,
  },
  activeBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  expiredBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  statusText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#17171A",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.15)",
  },
  summaryLabel: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 7,
  },
  summaryValue: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
  },
  infoBlock: {
    backgroundColor: "#17171A",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.12)",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    marginBottom: 8,
  },
  detailRow: {
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 167, 167, 0.12)",
    paddingVertical: 10,
  },
  lastDetailRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  rowLabel: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    flex: 1,
  },
  rowValue: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 20,
    flex: 1.2,
    textAlign: "right",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    flex: 1,
    minHeight: 66,
    justifyContent: "center",
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "#0B0B0D",
  },
  metricLabel: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_700Bold",
    fontSize: 9,
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  metricValue: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
  },
  notes: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  active: {
    color: "#22C55E",
  },
  expired: {
    color: "#EF4444",
  },
  buttonRow: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#F5B700",
    borderRadius: 14,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: "#17171A",
    borderRadius: 14,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.6)",
  },
  deleteButtonText: {
    color: "#EF4444",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
});
