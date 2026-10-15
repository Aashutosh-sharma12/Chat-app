import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { colors } from '@/config';
import { duration } from '@/utils/time';

const MIN_VOICE_MS = 800;
const MAX_VIDEO_SECONDS = 120;

type Props = {
  onSendText: (text: string) => void;
  onSendMedia: (type: 'image' | 'video' | 'audio', uri: string, mime: string, fileName?: string, durationSec?: number) => void;
  onTyping: () => void;
};

export function Composer({ onSendText, onSendMedia, onTyping }: Props) {
  const [text, setText] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 200);
  const recording = useRef(false);
  const held = useRef(false);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText('');
  };

  async function pick(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', `Allow ${source} access in Settings to share media.`);

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      quality: 0.7,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets?.[0]) return;

    const a = result.assets[0];
    const isVideo = a.type === 'video';
    const mime = a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
    onSendMedia(isVideo ? 'video' : 'image', a.uri, mime, a.fileName || undefined, a.duration ? a.duration / 1000 : undefined);
  }

  function attach() {
    Alert.alert('Share', undefined, [
      { text: 'Camera', onPress: () => pick('camera') },
      { text: 'Photo & Video Library', onPress: () => pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // Press and hold the mic to record; release to send.
  async function startRecording() {
    held.current = true;
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    if (!held.current) return; // released before the recorder was ready
    recorder.record();
    recording.current = true;
  }

  async function stopRecording() {
    held.current = false;
    if (!recording.current) return;
    recording.current = false;
    const ms = recorder.currentTime * 1000;
    await recorder.stop();
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (recorder.uri && ms >= MIN_VOICE_MS) {
      onSendMedia('audio', recorder.uri, 'audio/m4a', `voice-${Date.now()}.m4a`, ms / 1000);
    }
  }

  const isRecording = recState.isRecording;

  return (
    <View style={styles.bar}>
      {isRecording ? (
        <View style={[styles.inputWrap, styles.recordingWrap]}>
          <View style={styles.redDot} />
          <Text style={styles.recordingText}>{duration(recState.durationMillis / 1000)}</Text>
          <Text style={styles.hint}>Release to send</Text>
        </View>
      ) : (
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (v) onTyping();
            }}
            placeholder="Message"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
          />
          <Pressable onPress={attach} hitSlop={8}>
            <Ionicons name="attach" size={26} color={colors.muted} style={{ transform: [{ rotate: '-45deg' }] }} />
          </Pressable>
          <Pressable onPress={() => pick('camera')} hitSlop={8}>
            <Ionicons name="camera-outline" size={24} color={colors.muted} />
          </Pressable>
        </View>
      )}
      {text.trim() && !isRecording ? (
        <Pressable onPress={send} style={styles.action}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      ) : (
        // Stays mounted while recording so the release (onPressOut) is still received.
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          style={[styles.action, isRecording && styles.recordingAction]}
        >
          <Ionicons name="mic" size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', padding: 6, gap: 6 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 10, color: colors.text },
  action: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  recordingWrap: { gap: 10 },
  recordingAction: { transform: [{ scale: 1.15 }] },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  recordingText: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  hint: { flex: 1, color: colors.muted, textAlign: 'center' },
});
