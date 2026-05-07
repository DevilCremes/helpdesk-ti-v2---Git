import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { loadSavedCompany, useAppStore } from '../src/stores/appStore';
import { requestNotificationPermission } from '../src/hooks/useNotifications';
import Toast from '../src/components/UndoToast';

export default function RootLayout() {
  const setCurrentCompany = useAppStore(s => s.setCurrentCompany);
  const loadCompanies = useAppStore(s => s.loadCompanies);

  useEffect(() => {
    loadSavedCompany().then(saved => {
      if (saved) setCurrentCompany(saved.id, saved.name);
    });
    loadCompanies();
    requestNotificationPermission().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#0f3460" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0d1117' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="ticket/[id]"
            options={{ presentation: 'card', animation: 'slide_from_right' }}
          />
        </Stack>
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
