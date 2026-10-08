import { router } from "expo-router";
import {
  Montserrat_400Regular,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/montserrat";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DEMO_USERNAME = "admin";
const DEMO_EMAIL = "admin@gmail.com";
const DEMO_PASSWORD = "admin123";
const GMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isIdentifierValid = useMemo(() => {
    const trimmed = identifier.trim();
    return trimmed.length > 0 && (trimmed.toLowerCase() === DEMO_USERNAME || GMAIL_PATTERN.test(trimmed));
  }, [identifier]);

  const isPasswordValid = password.trim().length >= 6;
  const canSubmit = isIdentifierValid && isPasswordValid && !isSubmitting;

  const handleLogin = async () => {
    if (!isIdentifierValid || !isPasswordValid) {
      Alert.alert("Login failed", "Enter a valid admin username or Gmail address and the correct password.");
      return;
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const isValidCredentials =
      (normalizedIdentifier === DEMO_USERNAME || normalizedIdentifier === DEMO_EMAIL) &&
      password === DEMO_PASSWORD;

    if (!isValidCredentials) {
      Alert.alert("Login failed", "The username or password is incorrect.");
      return;
    }

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    login(normalizedIdentifier === DEMO_EMAIL ? "admin" : "admin");
    setIsSubmitting(false);

    router.replace("/home" as any);
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#F5B700" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Image
            accessibilityLabel="GymApp logo"
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>Life Time Fitness Zone</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username / Gmail</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setIdentifier}
              placeholder="Enter your username or Gmail"
              placeholderTextColor="#A7A7A7"
              style={[styles.input, !isIdentifierValid && identifier.length > 0 && styles.inputError]}
              textContentType="username"
              value={identifier}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordRow, !isPasswordValid && password.length > 0 && styles.inputError]}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password"
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#A7A7A7"
                secureTextEntry={!showPassword}
                style={styles.passwordInput}
                textContentType="password"
                value={password}
              />
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleButtonText}>{showPassword ? "Hide" : "Show"}</Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={handleLogin}
            style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Log in</Text>
            )}
          </Pressable>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0B0D",
  },
  container: {
    flex: 1,
    backgroundColor: "#0B0B0D",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: "#17171A",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#F5B700",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 183, 0, 0.25)",
  },
  logo: {
    alignSelf: "center",
    width: 112,
    height: 112,
    marginBottom: 10,
  },
  brandTitle: {
    color: "#FFD54A",
    fontFamily: "Montserrat_800ExtraBold",
    fontSize: 22,
    letterSpacing: 0.4,
    marginBottom: 24,
    textAlign: "center",
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#0B0B0D",
    borderColor: "rgba(167, 167, 167, 0.35)",
    borderRadius: 14,
    borderWidth: 1,
    color: "#FFFFFF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  passwordRow: {
    backgroundColor: "#0B0B0D",
    borderColor: "rgba(167, 167, 167, 0.35)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingRight: 10,
  },
  passwordInput: {
    color: "#FFFFFF",
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleButtonText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#F5B700",
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 52,
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: "#0B0B0D",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
  },
});
