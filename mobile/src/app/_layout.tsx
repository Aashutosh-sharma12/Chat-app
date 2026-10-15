import { useEffect } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '@/store/auth';
import { useChat } from '@/store/chat';
import { usePresence } from '@/store/presence';
import { tokenStore } from '@/services/tokenStore';
import { connectSocket, disconnectSocket, markActiveSeen } from '@/services/socket';
import { pushSupported } from '@/services/runtime';
import { colors } from '@/config';

export default function RootLayout() {
  const status = useAuth((s) => s.status);
  const signedIn = status === 'signedIn';

  useEffect(() => {
    useAuth.getState().hydrate();
    tokenStore.onExpired(() => useAuth.getState().signOutLocal());
  }, []);

  // Live connection + push registration for the signed-in user.
  useEffect(() => {
    if (!signedIn) return;
    connectSocket();
    const appState = AppState.addEventListener('change', (s) => s === 'active' && markActiveSeen());
    let tapSub: { remove: () => void } | undefined;
    if (pushSupported) {
      // Loaded lazily: remote push is not available in Expo Go.
      import('@/services/notifications').then((n) => {
        n.registerForPush();
        tapSub = n.addTapListener();
      });
    }
    return () => {
      appState.remove();
      tapSub?.remove();
      disconnectSocket();
      useChat.getState().reset();
      usePresence.getState().reset();
    };
  }, [signedIn]);

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[userId]" options={{ title: '' }} />
          <Stack.Screen name="new-chat" options={{ title: 'New chat' }} />
          <Stack.Screen name="call" options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="media-viewer" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
