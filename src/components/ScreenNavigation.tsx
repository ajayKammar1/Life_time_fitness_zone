import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ScreenNavigation() {
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/home" as any);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" onPress={goBack} style={styles.button}>
        <Text style={styles.buttonText}>‹  Back</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to dashboard"
        onPress={() => router.replace("/home" as any)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  button: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 213, 74, 0.42)",
    backgroundColor: "#17171A",
  },
  buttonText: {
    color: "#FFD54A",
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
  },
});
