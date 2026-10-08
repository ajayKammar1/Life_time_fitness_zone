import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createMember, getMembers, getMemberById, updateMember } from "@/lib/memberRepository";
import { getNextMemberCode } from "@/lib/memberService";
import { syncMembershipNotifications } from "@/lib/membershipNotifications";
import type { Member } from "@/lib/types";
import ScreenNavigation from "./ScreenNavigation";

const membershipPlans = ["Weekly", "Monthly", "Quarterly", "Half-Yearly", "Yearly", "Custom"];
const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEndDate(startDate: string, plan: string): string | null {
  if (plan === "Weekly") {
    const date = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + 7);
    return formatLocalDate(date);
  }

  const durationMonths: Record<string, number> = {
    Monthly: 1,
    Quarterly: 3,
    "Half-Yearly": 6,
    Yearly: 12,
  };
  const months = durationMonths[plan];
  if (months === undefined || plan === "Custom") return null;

  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  const targetMonth = month - 1 + months;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return formatLocalDate(new Date(year, targetMonth, Math.min(day, lastDay)));
}

const emptyForm = () => ({
  member_code: "",
  name: "",
  phone: "",
  email: "",
  gender: "Male",
  date_of_birth: "",
  height_cm: "",
  weight_kg: "",
  blood_group: "",
  address: "",
  membership_plan: "Monthly",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: getEndDate(new Date().toISOString().slice(0, 10), "Monthly") ?? "",
  amount: "0",
  emergency_contact: "",
  image_path: "",
  notes: "",
});

export default function MemberFormScreen() {
  const params = useLocalSearchParams<{ mode?: string; memberId?: string }>();
  const isEditing = params.mode === "edit" && Boolean(params.memberId);

  const buildInitialForm = () => {
    if (!isEditing || !params.memberId) {
      return {
        ...emptyForm(),
        member_code: getNextMemberCode(getMembers()),
      };
    }

    const memberId = Number(params.memberId);
    const member = getMemberById(memberId);
    if (!member) {
      router.replace("/members" as any);
      return emptyForm();
    }

    return {
      member_code: member.member_code,
      name: member.name,
      phone: member.phone,
      email: member.email ?? "",
      gender: member.gender ?? "Male",
      date_of_birth: member.date_of_birth ?? "",
      height_cm: member.height_cm == null ? "" : String(member.height_cm),
      weight_kg: member.weight_kg == null ? "" : String(member.weight_kg),
      blood_group: member.blood_group ?? "",
      address: member.address ?? "",
      membership_plan: member.membership_plan ?? "Monthly",
      start_date: member.start_date,
      end_date: member.end_date,
      amount: String(member.amount ?? 0),
      emergency_contact: member.emergency_contact ?? "",
      image_path: member.image_path ?? "",
      notes: member.notes ?? "",
    };
  };

  const [form, setForm] = useState(() => buildInitialForm());
  const [saving, setSaving] = useState(false);
  const [membershipMenuOpen, setMembershipMenuOpen] = useState(false);
  const [bloodGroupMenuOpen, setBloodGroupMenuOpen] = useState(false);

  const updateField = (field: keyof ReturnType<typeof emptyForm>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const selectMembershipPlan = (plan: string) => {
    setForm((current) => ({
      ...current,
      membership_plan: plan,
      end_date: getEndDate(current.start_date, plan) ?? current.end_date,
    }));
    setMembershipMenuOpen(false);
  };

  const updateStartDate = (startDate: string) => {
    setForm((current) => ({
      ...current,
      start_date: startDate,
      end_date: getEndDate(startDate, current.membership_plan) ?? current.end_date,
    }));
  };

  const handlePhotoPick = async (source: "camera" | "library") => {
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const folder = `${FileSystem.documentDirectory ?? ""}gym/members/`;
    await FileSystem.makeDirectoryAsync(folder, { intermediates: true });

    const fileName = `member_${Date.now()}.jpg`;
    const destination = `${folder}${fileName}`;
    await FileSystem.copyAsync({ from: asset.uri, to: destination });

    updateField("image_path", `gym/members/${fileName}`);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.membership_plan.trim() || !form.start_date || !form.end_date) {
      Alert.alert("Validation failed", "Please fill in the required member fields.");
      return;
    }

    const height = form.height_cm.trim() ? Number(form.height_cm) : null;
    const weight = form.weight_kg.trim() ? Number(form.weight_kg) : null;
    if (
      (height !== null && (!Number.isFinite(height) || height <= 0)) ||
      (weight !== null && (!Number.isFinite(weight) || weight <= 0))
    ) {
      Alert.alert("Validation failed", "Height and weight must be positive numbers.");
      return;
    }

    const payload = {
      member_code: form.member_code.trim() || getNextMemberCode(getMembers()),
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      gender: form.gender.trim() || null,
      date_of_birth: form.date_of_birth || null,
      height_cm: height,
      weight_kg: weight,
      blood_group: form.blood_group || null,
      address: form.address.trim() || null,
      membership_plan: form.membership_plan.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      amount: Number(form.amount || 0),
      emergency_contact: form.emergency_contact.trim() || null,
      image_path: form.image_path || null,
      notes: form.notes.trim() || null,
    };

    setSaving(true);

    try {
      if (isEditing && params.memberId) {
        const memberId = Number(params.memberId);
        updateMember(memberId, payload as Partial<Member>);
      } else {
        createMember(payload as Omit<Member, "id" | "created_at" | "updated_at">);
      }

      let reminderRefreshFailed = false;
      try {
        await syncMembershipNotifications();
      } catch (error) {
        console.error("Member saved, but membership reminders could not be updated:", error);
        reminderRefreshFailed = true;
      }

      const successMessage = isEditing ? "Member updated successfully." : "Member created successfully.";
      Alert.alert(
        "Success",
        reminderRefreshFailed
          ? `${successMessage} Expiry reminders could not be refreshed; reopen the app to try again.`
          : successMessage,
      );
      router.replace("/members" as any);
    } catch {
      Alert.alert("Error", "Unable to save member. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const imageUri = form.image_path ? `${FileSystem.documentDirectory ?? ""}${form.image_path}` : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenNavigation />
      <Text style={styles.title}>{isEditing ? "Edit Member" : "Add Member"}</Text>

      <View style={styles.photoSection}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} />
        ) : (
          <View style={styles.placeholderPhoto}>
            <Text style={styles.placeholderText}>No photo</Text>
          </View>
        )}
        <View style={styles.photoActions}>
          <Pressable onPress={() => handlePhotoPick("camera")} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>Camera</Text>
          </Pressable>
          <Pressable onPress={() => handlePhotoPick("library")} style={styles.smallButtonAlt}>
            <Text style={styles.smallButtonText}>Gallery</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.label}>Member Code</Text>
      <TextInput value={form.member_code} onChangeText={(value) => updateField("member_code", value)} style={styles.input} />

      <Text style={styles.label}>Full Name *</Text>
      <TextInput value={form.name} onChangeText={(value) => updateField("name", value)} style={styles.input} />

      <Text style={styles.label}>Mobile Number *</Text>
      <TextInput keyboardType="phone-pad" value={form.phone} onChangeText={(value) => updateField("phone", value)} style={styles.input} />

      <Text style={styles.label}>Email</Text>
      <TextInput keyboardType="email-address" value={form.email} onChangeText={(value) => updateField("email", value)} style={styles.input} />

      <Text style={styles.label}>Gender</Text>
      <TextInput value={form.gender} onChangeText={(value) => updateField("gender", value)} style={styles.input} />

      <Text style={styles.label}>Date of Birth</Text>
      <TextInput value={form.date_of_birth} onChangeText={(value) => updateField("date_of_birth", value)} placeholder="YYYY-MM-DD" style={styles.input} />

      <Text style={styles.label}>Height (cm)</Text>
      <TextInput keyboardType="decimal-pad" value={form.height_cm} onChangeText={(value) => updateField("height_cm", value)} placeholder="e.g. 175" style={styles.input} />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput keyboardType="decimal-pad" value={form.weight_kg} onChangeText={(value) => updateField("weight_kg", value)} placeholder="e.g. 70" style={styles.input} />

      <FormDropdown
        label="Blood Group"
        value={form.blood_group}
        placeholder="Select blood group"
        options={bloodGroups}
        isOpen={bloodGroupMenuOpen}
        onToggle={() => setBloodGroupMenuOpen((open) => !open)}
        onSelect={(value) => {
          updateField("blood_group", value);
          setBloodGroupMenuOpen(false);
        }}
      />

      <FormDropdown
        label="Membership Plan *"
        value={form.membership_plan}
        options={membershipPlans}
        isOpen={membershipMenuOpen}
        onToggle={() => setMembershipMenuOpen((open) => !open)}
        onSelect={selectMembershipPlan}
      />

      <Text style={styles.label}>Start Date *</Text>
      <TextInput value={form.start_date} onChangeText={updateStartDate} placeholder="YYYY-MM-DD" style={styles.input} />

      <Text style={styles.label}>End Date *</Text>
      <TextInput value={form.end_date} onChangeText={(value) => updateField("end_date", value)} placeholder="YYYY-MM-DD" style={styles.input} />

      <Text style={styles.label}>Amount</Text>
      <TextInput keyboardType="numeric" value={form.amount} onChangeText={(value) => updateField("amount", value)} style={styles.input} />

      <Text style={styles.label}>Emergency Contact</Text>
      <TextInput value={form.emergency_contact} onChangeText={(value) => updateField("emergency_contact", value)} style={styles.input} />

      <Text style={styles.label}>Address</Text>
      <TextInput value={form.address} onChangeText={(value) => updateField("address", value)} multiline style={[styles.input, styles.textArea]} />

      <Text style={styles.label}>Notes</Text>
      <TextInput value={form.notes} onChangeText={(value) => updateField("notes", value)} multiline style={[styles.input, styles.textArea]} />

      <Pressable onPress={handleSave} disabled={saving} style={[styles.saveButton, saving && styles.disabledButton]}>
        <Text style={styles.saveButtonText}>{saving ? "Saving..." : isEditing ? "Update Member" : "Save Member"}</Text>
      </Pressable>
    </ScrollView>
  );
}

type FormDropdownProps = {
  label: string;
  value: string;
  placeholder?: string;
  options: string[];
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

function FormDropdown({
  label,
  value,
  placeholder,
  options,
  isOpen,
  onToggle,
  onSelect,
}: FormDropdownProps) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.dropdown}>
        <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>{isOpen ? "▲" : "▼"}</Text>
      </Pressable>
      {isOpen ? (
        <View style={styles.dropdownOptions}>
          {options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onSelect(option)}
              style={styles.dropdownOption}
            >
              <Text style={[styles.dropdownOptionText, option === value && styles.selectedDropdownOption]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0D",
  },
  content: {
    padding: 20,
    paddingTop: 52,
    paddingBottom: 40,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 28,
    marginBottom: 18,
  },
  photoSection: {
    marginBottom: 20,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#17171A",
    alignSelf: "center",
  },
  placeholderPhoto: {
    width: 110,
    height: 110,
    borderRadius: 16,
    backgroundColor: "#17171A",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.25)",
  },
  placeholderText: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
  },
  photoActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 12,
  },
  smallButton: {
    backgroundColor: "#F5B700",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  smallButtonAlt: {
    backgroundColor: "#17171A",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.45)",
  },
  smallButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
  },
  label: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#17171A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.25)",
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdown: {
    minHeight: 46,
    backgroundColor: "#17171A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 167, 167, 0.25)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownValue: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: "#A7A7A7",
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
  },
  dropdownArrow: {
    color: "#FFD54A",
    fontSize: 14,
  },
  dropdownOptions: {
    backgroundColor: "#17171A",
    borderColor: "rgba(245, 183, 0, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 167, 167, 0.12)",
  },
  dropdownOptionText: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
  },
  selectedDropdownOption: {
    color: "#FFD54A",
    fontFamily: "Montserrat_700Bold",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#F5B700",
    borderRadius: 14,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  disabledButton: {
    opacity: 0.8,
  },
  saveButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
});
