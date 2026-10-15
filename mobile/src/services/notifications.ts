import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { pushApi } from '@/api/endpoints';
import { useChat } from '@/store/chat';

import { setPushToken } from './pushToken';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { kind?: string; conversationId?: string };
    // Don't show a banner for the chat that is already open.
    const inOpenChat = data?.kind === 'message' && data.conversationId === useChat.getState().activeConversationId;
    return { shouldShowBanner: !inOpenChat, shouldShowList: !inOpenChat, shouldPlaySound: !inOpenChat, shouldSetBadge: false };
  },
});

export async function registerForPush() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 1000, 1000],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  if (!Device.isDevice) return null; // push needs a physical device

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId. Run `npx eas-cli init` to enable push notifications.');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    setPushToken(token);
    await pushApi.register(token);
    return token;
  } catch (err) {
    console.warn('[push] registration failed', err);
    return null;
  }
}

export function addTapListener() {
  Notifications.getLastNotificationResponseAsync().then((r) => r && handleNotificationResponse(r));
  return Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
}

// Opening a notification: message -> that chat. Incoming call -> the socket re-sends the ringing call on connect.
export function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as { kind?: string; userId?: string };
  if ((data?.kind === 'message' || data?.kind === 'missed-call') && data.userId) {
    router.push({ pathname: '/chat/[userId]', params: { userId: data.userId } });
  }
}
