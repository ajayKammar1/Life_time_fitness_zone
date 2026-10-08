import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import * as FileSystem from "expo-file-system/legacy";
import { useAuthStore } from "@/store/authStore";
import { getMembers, searchMembers } from "@/lib/memberRepository";
import { getMembershipStatus } from "@/lib/memberService";
import type { Member } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type MemberFilter = "All" | "Active" | "Expiring" | "Expired";

const filters: MemberFilter[] = ["All", "Active", "Expiring", "Expired"];

function isMemberFilter(value: string | undefined): value is MemberFilter {
  return value === "All" || value === "Active" || value === "Expiring" || value === "Expired";
}

function getDaysUntilExpiry(endDate: string): number | null {
  const [year, month, day] = endDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const expiry = Date.UTC(year, month - 1, day);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const date = new Date(expiry);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return Math.round((expiry - todayUtc) / (24 * 60 * 60 * 1000));
}

function getExpiryLabel(days: number | null): string {
  if (days === null) return "Expiry date not set";
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function getWhatsAppPhoneNumber(phone: string): string | null {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  if (digits.startsWith("00")) {
    const internationalDigits = digits.slice(2);
    return internationalDigits.length >= 8 && internationalDigits.length <= 15
      ? internationalDigits
      : null;
  }

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return null;
}

export default function MemberListScreen() {
  const { isAuthenticated } = useAuthStore();
  const params = useLocalSearchParams<{ filter?: string }>();
  const selectedFilter = isMemberFilter(params.filter) ? params.filter : "All";
  const [query, setQuery] = useState("");
  const [allMembers, setAllMembers] = useState(() => (isAuthenticated ? getMembers() : []));
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/" as any);
    }
  }, [isAuthenticated]);

  const refreshMembers = useCallback(() => {
    if (isAuthenticated) setAllMembers(getMembers());
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      refreshMembers();
    }, [refreshMembers]),
  );

  const visibleMembers = useMemo(() => {
    if (!isAuthenticated) return [];

    const searched = query.trim() ? searchMembers(query) : allMembers;
    return searched.filter((member) => {
      const status = getMembershipStatus(member.end_date);
      const daysUntilExpiry = getDaysUntilExpiry(member.end_date);

      if (selectedFilter === "Active") return status === "ACTIVE";
      if (selectedFilter === "Expiring") {
        return status === "ACTIVE" && daysUntilExpiry !== null && daysUntilExpiry <= 7;
      }
      if (selectedFilter === "Expired") return status === "EXPIRED";
      return true;
    });
  }, [allMembers, isAuthenticated, query, selectedFilter]);

  const counts = useMemo(() => {
    const active = allMembers.filter((member) => getMembershipStatus(member.end_date) === "ACTIVE").length;
    const expiring = allMembers.filter((member) => {
      const days = getDaysUntilExpiry(member.end_date);
      return getMembershipStatus(member.end_date) === "ACTIVE" && days !== null && days <= 7;
    }).length;
    return {
      All: allMembers.length,
      Active: active,
      Expiring: expiring,
      Expired: allMembers.length - active,
    };
  }, [allMembers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMembers();
    setIsRefreshing(false);
  };

  if (!isAuthenticated) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>MEMBER MANAGEMENT</Text>
          <Text style={styles.subtitle}>
            {allMembers.length} member{allMembers.length === 1 ? "" : "s"} registered
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to dashboard"
          onPress={() => router.replace("/home" as any)}
          style={styles.homeButton}
        >
          <Text style={styles.homeButtonText}>Home</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          accessibilityLabel="Search members by name, phone, or member code"
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone or ID"
          placeholderTextColor="#85858B"
          returnKeyType="search"
          style={styles.searchInput}
        />
        {query.length > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery("")}>
            <Text style={styles.clearSearch}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isSelected = item === selectedFilter;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => router.setParams({ filter: item } as any)}
                style={[styles.filterChip, isSelected && styles.selectedFilterChip]}
              >
                <Text style={[styles.filterText, isSelected && styles.selectedFilterText]}>{item}</Text>
                <Text style={[styles.filterCount, isSelected && styles.selectedFilterText]}>{counts[item]}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={visibleMembers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[
          styles.listContent,
          visibleMembers.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#F5B700"
            colors={["#F5B700"]}
          />
        }
        renderItem={({ item }) => <MemberCard member={item} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>{query ? "⌕" : "＋"}</Text>
            </View>
            <Text style={styles.emptyTitle}>
              {query ? "No matching members" : selectedFilter === "All" ? "No members yet" : `No ${selectedFilter.toLowerCase()} members`}
            </Text>
            <Text style={styles.emptyDescription}>
              {query
                ? "Try another name, phone number, or member ID."
                : selectedFilter === "All"
                  ? "There are no members to display yet."
                  : "There are no members in this category right now."}
            </Text>
          </View>
        }
      />
      <Text style={styles.resultsText}>
        Showing {visibleMembers.length} of {allMembers.length}
      </Text>
      <View style={styles.bottomActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/member-form", params: { mode: "create" } } as any)}
          style={styles.addMemberButton}
        >
          <Text style={styles.addMemberButtonText}>+  Add Member</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MemberCard({ member }: { member: Member }) {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [isMessageEditorOpen, setIsMessageEditorOpen] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const status = getMembershipStatus(member.end_date);
  const daysUntilExpiry = getDaysUntilExpiry(member.end_date);
  const needsRenewalMessage = status === "EXPIRED" || (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7);
  const imageUri = member.image_path
    ? `${FileSystem.documentDirectory ?? ""}${member.image_path}`
    : undefined;
  const initials = member.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const expiryTone =
    status === "EXPIRED" ? styles.expiredText : daysUntilExpiry !== null && daysUntilExpiry <= 7 ? styles.expiringText : styles.activeText;

  const defaultMessage = status === "EXPIRED"
    ? `Hi ${member.name}, your ${member.membership_plan} membership at Life Time Fitness Zone expired on ${member.end_date}. We would love to welcome you back. Reply here to renew your membership.`
    : `Hi ${member.name}, your ${member.membership_plan} membership at Life Time Fitness Zone expires on ${member.end_date}. Reply here if you would like to renew it.`;

  const openMessageEditor = () => {
    setCustomMessage(defaultMessage);
    setIsMessageEditorOpen(true);
  };

  const handleWhatsAppNotify = async () => {
    const phoneNumber = getWhatsAppPhoneNumber(member.phone);
    if (!phoneNumber) {
      setIsMessageEditorOpen(false);
      Alert.alert(
        "Phone number needs updating",
        "Enter a valid phone number with a country code, or use a 10-digit Indian mobile number.",
      );
      return;
    }

    if (!customMessage.trim()) {
      Alert.alert("Message required", "Enter a message before opening WhatsApp.");
      return;
    }

    try {
      await Linking.openURL(
        `https://wa.me/${phoneNumber}?text=${encodeURIComponent(customMessage.trim())}`,
      );
      setIsMessageEditorOpen(false);
    } catch (error) {
      console.error("Unable to open WhatsApp renewal message:", error);
      Alert.alert(
        "Unable to open WhatsApp",
        "Please check that WhatsApp is installed and try again.",
      );
    }
  };

  return (
    <View style={styles.memberCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${member.name}, ${status.toLowerCase()}, membership ${member.membership_plan}`}
        onPress={() => router.push({ pathname: "/member-details", params: { memberId: String(member.id) } } as any)}
        style={({ pressed }) => [styles.memberCardMain, pressed && styles.cardPressed]}
      >
        {imageUri ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${member.name}'s profile photo`}
            onPress={(event) => {
              event.stopPropagation();
              setIsImageOpen(true);
            }}
          >
            <Image source={{ uri: imageUri }} style={styles.avatar} />
          </Pressable>
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials || "M"}</Text>
          </View>
        )}

        <View style={styles.memberInfo}>
          <View style={styles.memberHeading}>
            <Text numberOfLines={1} style={styles.memberName}>{member.name}</Text>
            <View style={[styles.statusBadge, status === "ACTIVE" ? styles.activeBadge : styles.expiredBadge]}>
              <Text style={[styles.statusText, status === "ACTIVE" ? styles.activeText : styles.expiredText]}>
                {status === "ACTIVE" ? "ACTIVE" : "EXPIRED"}
              </Text>
            </View>
          </View>

          <Text numberOfLines={1} style={styles.memberMeta}>
            {member.member_code}  ·  {member.phone}
          </Text>

          <View style={styles.cardFooter}>
            <View style={styles.planPill}>
              <Text numberOfLines={1} style={styles.planText}>{member.membership_plan || "Membership"}</Text>
            </View>
            <Text numberOfLines={1} style={[styles.expiryText, expiryTone]}>
              {getExpiryLabel(daysUntilExpiry)}
            </Text>
          </View>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {needsRenewalMessage ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Send ${status === "EXPIRED" ? "expired membership" : "expiring membership"} WhatsApp message to ${member.name}`}
          onPress={openMessageEditor}
          style={styles.whatsappButton}
        >
          <Text style={styles.whatsappIcon}>◉</Text>
          <Text style={styles.whatsappButtonText}>Notify on WhatsApp</Text>
        </Pressable>
      ) : null}

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
      <Modal
        visible={isMessageEditorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMessageEditorOpen(false)}
      >
        <View style={styles.messageModalBackdrop}>
          <View style={styles.messageModalCard}>
            <Text style={styles.messageModalTitle}>WhatsApp message</Text>
            <Text style={styles.messageModalHint}>Edit this message before opening WhatsApp.</Text>
            <TextInput
              accessibilityLabel="Custom WhatsApp message"
              multiline
              textAlignVertical="top"
              value={customMessage}
              onChangeText={setCustomMessage}
              style={styles.messageInput}
              placeholder="Write a message..."
              placeholderTextColor="#85858B"
            />
            <View style={styles.messageModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsMessageEditorOpen(false)}
                style={styles.messageCancelButton}
              >
                <Text style={styles.messageCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleWhatsAppNotify()}
                style={styles.messageSendButton}
              >
                <Text style={styles.messageSendText}>Continue to WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0D",
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  homeButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.42)",
    backgroundColor: "#17171A",
  },
  homeButtonText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  eyebrow: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  subtitle: {
    color: "#85858B",
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    paddingTop: 10,
    paddingBottom: 16,
  },
  addMemberButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#F5B700",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  addMemberButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
  },
  searchBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#17171A",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.18)",
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchIcon: {
    color: "#FFD54A",
    fontSize: 24,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    paddingVertical: 8,
  },
  clearSearch: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_400Regular",
    fontSize: 25,
    paddingLeft: 10,
  },
  filterContainer: {
    marginHorizontal: -18,
    marginBottom: 10,
  },
  filterList: {
    paddingHorizontal: 18,
    gap: 8,
  },
  filterChip: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.2)",
    backgroundColor: "#17171A",
    paddingHorizontal: 13,
  },
  selectedFilterChip: {
    borderColor: "#F5B700",
    backgroundColor: "rgba(245, 183, 0, 0.14)",
  },
  filterText: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
  },
  filterCount: {
    color: "#85858B",
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
  },
  selectedFilterText: {
    color: "#FFD54A",
  },
  listContent: {
    paddingTop: 2,
    paddingBottom: 10,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  memberCard: {
    backgroundColor: "#17171A",
    borderRadius: 17,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.13)",
    marginBottom: 10,
  },
  memberCardMain: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardPressed: {
    opacity: 0.78,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: "#0B0B0D",
    marginRight: 12,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 15,
    marginRight: 12,
    backgroundColor: "rgba(245, 183, 0, 0.13)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.2)",
  },
  avatarInitials: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
    fontSize: 17,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  memberName: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    flex: 1,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  activeBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  expiredBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  statusText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 8,
    letterSpacing: 0.4,
  },
  activeText: {
    color: "#22C55E",
  },
  expiredText: {
    color: "#EF4444",
  },
  expiringText: {
    color: "#FFD54A",
  },
  memberMeta: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    marginTop: 5,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 9,
  },
  planPill: {
    maxWidth: "45%",
    borderRadius: 8,
    backgroundColor: "#0B0B0D",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planText: {
    color: "#C7C7CB",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 9,
  },
  expiryText: {
    flex: 1,
    textAlign: "right",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 10,
  },
  chevron: {
    color: "#85858B",
    fontSize: 25,
    paddingLeft: 9,
  },
  whatsappButton: {
    minHeight: 38,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 11,
    backgroundColor: "rgba(37, 211, 102, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(37, 211, 102, 0.35)",
    marginTop: 11,
  },
  whatsappIcon: {
    color: "#25D366",
    fontSize: 17,
  },
  whatsappButtonText: {
    color: "#25D366",
    fontFamily: "Montserrat_700Bold",
    fontSize: 11,
  },
  messageModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.78)",
    padding: 22,
  },
  messageModalCard: {
    width: "100%",
    backgroundColor: "#17171A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.3)",
    padding: 18,
  },
  messageModalTitle: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
  },
  messageModalHint: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    marginTop: 5,
    marginBottom: 14,
  },
  messageInput: {
    minHeight: 150,
    maxHeight: 240,
    color: "#FFFFFF",
    backgroundColor: "#0B0B0D",
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.25)",
    borderRadius: 12,
    padding: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 21,
  },
  messageModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  messageCancelButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.25)",
  },
  messageCancelText: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
  },
  messageSendButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: "#25D366",
  },
  messageSendText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
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
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 25,
    paddingVertical: 36,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(245, 183, 0, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyIconText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 30,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    textAlign: "center",
  },
  emptyDescription: {
    color: "#85858B",
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },
  emptyAddButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F5B700",
    marginTop: 17,
  },
  emptyAddText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
  },
  resultsText: {
    color: "#73737A",
    fontFamily: "Montserrat_400Regular",
    fontSize: 10,
    textAlign: "center",
    paddingBottom: 8,
  },
});
