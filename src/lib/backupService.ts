import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import { db } from "./database";
import { getMembers } from "./memberRepository";
import type { Member } from "./types";

const BACKUP_FORMAT = "life-time-fitness-zone-backup";
const BACKUP_VERSION = 1;
const IMAGE_DIRECTORY = "gym/members/";
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);

type BackupMember = Omit<Member, "id">;

type BackupRecord = {
  member: BackupMember;
  photo: { extension: string; base64: string } | null;
};

export type GymBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  members: BackupRecord[];
};

function requireDirectory(directory: string | null): string {
  if (!directory) {
    throw new Error("The app's local file storage is unavailable.");
  }
  return directory;
}

function getImageExtension(imagePath: string): string {
  if (!imagePath.startsWith(IMAGE_DIRECTORY) || imagePath.includes("..") || imagePath.includes("\\")) {
    throw new Error("A member photo has an invalid local path. Fix or remove it before backing up.");
  }
  const fileName = imagePath.slice(IMAGE_DIRECTORY.length);
  if (!fileName || fileName.includes("/")) {
    throw new Error("A member photo has an invalid local path. Fix or remove it before backing up.");
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported member photo format: ${extension || "unknown"}.`);
  }
  return extension;
}

async function createBackupJson(): Promise<{ contents: string; memberCount: number }> {
  const members = getMembers();
  const records: BackupRecord[] = [];
  const documentDirectory = requireDirectory(FileSystem.documentDirectory);

  for (const member of members) {
    let photo: BackupRecord["photo"] = null;
    if (member.image_path) {
      const extension = getImageExtension(member.image_path);
      const imageUri = `${documentDirectory}${member.image_path}`;
      const info = await FileSystem.getInfoAsync(imageUri);
      if (!info.exists || info.isDirectory) {
        throw new Error(`The profile photo for ${member.name} is missing. Backup was not created.`);
      }
      photo = {
        extension,
        base64: await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        }),
      };
    }

    const { id: _id, ...backupMember } = member;
    records.push({ member: backupMember, photo });
  }

  const backup: GymBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    members: records,
  };
  return { contents: JSON.stringify(backup), memberCount: members.length };
}

export async function createAndShareBackup(): Promise<number> {
  const { contents, memberCount } = await createBackupJson();
  const cacheDirectory = requireDirectory(FileSystem.cacheDirectory);
  const fileUri = `${cacheDirectory}gym-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("File sharing is unavailable on this device.");
    }
    await Sharing.shareAsync(fileUri, {
      dialogTitle: "Share Gym Data Backup",
      mimeType: "application/json",
      UTI: "public.json",
    });
  } finally {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }

  return memberCount;
}

export async function saveBackupToDevice(): Promise<number | null> {
  const { contents, memberCount } = await createBackupJson();

  if (Platform.OS === "android") {
    const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return null;

    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      `gym-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`,
      "application/json",
    );
    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return memberCount;
  }

  const cacheDirectory = requireDirectory(FileSystem.cacheDirectory);
  const fileUri = `${cacheDirectory}gym-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(fileUri, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Saving a file is unavailable on this device.");
    }
    await Sharing.shareAsync(fileUri, {
      dialogTitle: "Save Gym Data Backup",
      mimeType: "application/json",
      UTI: "public.json",
    });
  } finally {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
  return memberCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function optionalNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || (typeof value === "number" && Number.isFinite(value));
}

function validateBackup(value: unknown): GymBackup {
  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error("This file is not a supported GymApp backup.");
  }
  if (!Array.isArray(value.members) || typeof value.createdAt !== "string") {
    throw new Error("The backup file is incomplete or malformed.");
  }

  const memberCodes = new Set<string>();
  const members: BackupRecord[] = value.members.map((entry, index) => {
    if (!isRecord(entry) || !isRecord(entry.member)) {
      throw new Error(`Backup member ${index + 1} is malformed.`);
    }

    const member = entry.member;
    const requiredStrings = [
      "member_code",
      "name",
      "phone",
      "membership_plan",
      "start_date",
      "end_date",
      "created_at",
      "updated_at",
    ] as const;
    if (requiredStrings.some((field) => typeof member[field] !== "string" || !member[field])) {
      throw new Error(`Backup member ${index + 1} is missing required details.`);
    }
    if (typeof member.amount !== "number" || !Number.isFinite(member.amount)) {
      throw new Error(`Backup member ${index + 1} has an invalid amount.`);
    }
    if (
      !optionalString(member.email) ||
      !optionalString(member.gender) ||
      !optionalString(member.date_of_birth) ||
      !optionalNumber(member.height_cm) ||
      !optionalNumber(member.weight_kg) ||
      !optionalString(member.blood_group) ||
      !optionalString(member.address) ||
      !optionalString(member.emergency_contact) ||
      !optionalString(member.image_path) ||
      !optionalString(member.notes)
    ) {
      throw new Error(`Backup member ${index + 1} contains invalid field values.`);
    }

    const memberCode = member.member_code as string;
    if (memberCodes.has(memberCode)) {
      throw new Error(`The backup contains duplicate member code ${memberCode}.`);
    }
    memberCodes.add(memberCode);

    let photo: BackupRecord["photo"] = null;
    if (entry.photo !== null) {
      if (!isRecord(entry.photo)) {
        throw new Error(`The profile photo for backup member ${index + 1} is malformed.`);
      }
      const extension = entry.photo.extension;
      const base64 = entry.photo.base64;
      if (
        typeof extension !== "string" ||
        !IMAGE_EXTENSIONS.has(extension.toLowerCase()) ||
        typeof base64 !== "string" ||
        base64.length === 0 ||
        base64.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
      ) {
        throw new Error(`The profile photo for backup member ${index + 1} is invalid.`);
      }
      if (typeof member.image_path !== "string" || !member.image_path) {
        throw new Error(`Backup member ${index + 1} has an unlinked profile photo.`);
      }
      if (getImageExtension(member.image_path) !== extension.toLowerCase()) {
        throw new Error(`The profile photo format for backup member ${index + 1} does not match its filename.`);
      }
      photo = { extension: extension.toLowerCase(), base64 };
    } else if (typeof member.image_path === "string" && member.image_path) {
      throw new Error(`The profile photo for backup member ${index + 1} is missing from the backup.`);
    }

    const validatedMember: BackupMember = {
      member_code: member.member_code as string,
      name: member.name as string,
      phone: member.phone as string,
      email: member.email as string | null | undefined,
      gender: member.gender as string | null | undefined,
      date_of_birth: member.date_of_birth as string | null | undefined,
      height_cm: member.height_cm as number | null | undefined,
      weight_kg: member.weight_kg as number | null | undefined,
      blood_group: member.blood_group as string | null | undefined,
      address: member.address as string | null | undefined,
      membership_plan: member.membership_plan as string,
      start_date: member.start_date as string,
      end_date: member.end_date as string,
      amount: member.amount,
      emergency_contact: member.emergency_contact as string | null | undefined,
      image_path: null,
      notes: member.notes as string | null | undefined,
      created_at: member.created_at as string,
      updated_at: member.updated_at as string,
    };

    return { member: validatedMember, photo };
  });

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: value.createdAt,
    members,
  };
}

export async function chooseBackup(): Promise<GymBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled) return null;

  const source = result.assets[0];
  const cacheDirectory = requireDirectory(FileSystem.cacheDirectory);
  const cachedUri = `${cacheDirectory}gym-restore-${Date.now()}.json`;
  let contents: string;
  try {
    await FileSystem.copyAsync({ from: source.uri, to: cachedUri });
    contents = await FileSystem.readAsStringAsync(cachedUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch (error) {
    throw new Error(
      `Could not access ${source.name}. Re-select the backup from your device's Files or Downloads app and try again. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    await FileSystem.deleteAsync(cachedUri, { idempotent: true }).catch((error: unknown) => {
      console.warn("Could not remove temporary restore file:", error);
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  return validateBackup(parsed);
}

export async function replaceMembersFromBackup(backup: GymBackup): Promise<{
  memberCount: number;
  cleanupWarning?: string;
}> {
  const documentDirectory = requireDirectory(FileSystem.documentDirectory);
  const imageDirectory = `${documentDirectory}${IMAGE_DIRECTORY}`;
  const oldImagePaths = db.getAllSync<{ image_path: string | null }>(
    "SELECT DISTINCT image_path FROM members WHERE image_path IS NOT NULL",
  ).map(({ image_path }) => image_path).filter((path): path is string => Boolean(path));
  const prepared: { member: BackupMember; imagePath: string | null }[] = [];
  const createdImagePaths: string[] = [];

  await FileSystem.makeDirectoryAsync(imageDirectory, { intermediates: true });

  try {
    for (const [index, record] of backup.members.entries()) {
      let imagePath: string | null = null;
      if (record.photo) {
        const fileName = `restore-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${record.photo.extension}`;
        imagePath = `${IMAGE_DIRECTORY}${fileName}`;
        createdImagePaths.push(imagePath);
        await FileSystem.writeAsStringAsync(`${documentDirectory}${imagePath}`, record.photo.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
      prepared.push({ member: record.member, imagePath });
    }

    db.withTransactionSync(() => {
      db.runSync("DELETE FROM members");
      for (const { member, imagePath } of prepared) {
        db.runSync(
          `INSERT INTO members (
            member_code, name, phone, email, gender, date_of_birth, height_cm, weight_kg,
            blood_group, address, membership_plan, start_date, end_date, amount,
            emergency_contact, image_path, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            member.member_code,
            member.name,
            member.phone,
            member.email ?? null,
            member.gender ?? null,
            member.date_of_birth ?? null,
            member.height_cm ?? null,
            member.weight_kg ?? null,
            member.blood_group ?? null,
            member.address ?? null,
            member.membership_plan,
            member.start_date,
            member.end_date,
            member.amount,
            member.emergency_contact ?? null,
            imagePath,
            member.notes ?? null,
            member.created_at,
            member.updated_at,
          ],
        );
      }
    });
  } catch (error) {
    const cleanupErrors: string[] = [];
    for (const imagePath of createdImagePaths) {
      try {
        await FileSystem.deleteAsync(`${documentDirectory}${imagePath}`, { idempotent: true });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError instanceof Error ? cleanupError.message : String(cleanupError));
      }
    }
    const originalMessage = error instanceof Error ? error.message : String(error);
    if (cleanupErrors.length) {
      throw new Error(`Restore failed: ${originalMessage}. Temporary photo cleanup also failed: ${cleanupErrors.join("; ")}`);
    }
    throw new Error(`Restore failed. Your existing member data was not replaced: ${originalMessage}`);
  }

  const cleanupErrors: string[] = [];
  for (const imagePath of oldImagePaths) {
    if (!imagePath.startsWith(IMAGE_DIRECTORY) || imagePath.includes("..") || imagePath.includes("\\")) continue;
    try {
      await FileSystem.deleteAsync(`${documentDirectory}${imagePath}`, { idempotent: true });
    } catch (error) {
      cleanupErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    memberCount: prepared.length,
    ...(cleanupErrors.length
      ? { cleanupWarning: `Data was restored, but some old photos could not be removed: ${cleanupErrors.join("; ")}` }
      : {}),
  };
}
