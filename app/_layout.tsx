import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Platform, View, StyleSheet } from "react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoginModal from "@/components/LoginModal";
import { UpdateModal } from "@/components/UpdateModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppInitialization } from "@/hooks/useAppInitialization";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = "dark";
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useAppInitialization(loaded, error);

  if (!loaded && !error) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <View style={styles.container}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="detail" options={{ headerShown: false }} />
              {Platform.OS !== "web" && <Stack.Screen name="play" options={{ headerShown: false }} />}
              <Stack.Screen name="related" options={{ headerShown: false }} />
              <Stack.Screen name="search" options={{ headerShown: false }} />
              <Stack.Screen name="live" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="favorites" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </View>
          <Toast />
          <LoginModal />
          <UpdateModal />
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
