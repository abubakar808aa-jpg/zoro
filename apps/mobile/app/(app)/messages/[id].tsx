import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { subscribeToMessages, sendMessage } from '@/lib/firestore';
import { auth, db, storage } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import type { Message, Conversation } from '@jobman/shared/src/types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = auth.currentUser;
  const [messages, setMessages] = useState<Message[]>([]);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'conversations', id)).then(snap => {
      if (snap.exists()) setConv({ id: snap.id, ...snap.data() } as Conversation);
    });
    return subscribeToMessages(id, msgs => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [id, user]);

  async function handleSend(file?: { uri: string; name: string; mimeType?: string } | null) {
    if (!user || (!text.trim() && !file)) return;
    setSending(true);
    try {
      let fileObj: File | undefined;
      if (file) {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        fileObj = new File([blob], file.name, { type: file.mimeType ?? 'application/octet-stream' });
      }
      await sendMessage(id, user.uid, text.trim(), fileObj);
      setText('');
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSending(false); }
  }

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      handleSend({ uri: asset.uri, name: asset.fileName ?? 'image.jpg', mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  }

  async function pickDocument() {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] });
    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      handleSend({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream' });
    }
  }

  const otherId = conv?.participants.find(p => p !== user?.uid) ?? '';
  const otherName = conv?.participantNames?.[otherId] ?? 'User';
  const otherPhoto = conv?.participantPhotos?.[otherId];

  return (
    <KeyboardAvoidingView className="flex-1 bg-slate-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-3 border-b border-slate-100 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}><Text className="text-slate-400 text-lg">←</Text></TouchableOpacity>
        {otherPhoto ? (
          <Image source={{ uri: otherPhoto }} className="w-9 h-9 rounded-full" />
        ) : (
          <View className="w-9 h-9 rounded-full bg-primary-100 items-center justify-center">
            <Text className="text-primary-700 font-bold">{otherName[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View>
          <Text className="font-semibold text-slate-900 text-sm">{otherName}</Text>
          <Text className="text-green-500 text-xs">Online</Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList ref={flatRef} data={messages} keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: msg }) => {
          const isMine = msg.senderId === user?.uid;
          const time = msg.createdAt ? formatDistanceToNow(new Date((msg.createdAt as any).seconds * 1000), { addSuffix: true }) : '';
          return (
            <View className={`flex-row ${isMine ? 'justify-end' : 'justify-start'}`}>
              <View className={`max-w-xs rounded-2xl px-4 py-2.5 ${isMine ? 'bg-primary-600 rounded-br-sm' : 'bg-white border border-slate-100 rounded-bl-sm'}`}>
                {msg.fileUrl && msg.fileType === 'image' && (
                  <Image source={{ uri: msg.fileUrl }} className="w-48 h-32 rounded-xl mb-2" resizeMode="cover" />
                )}
                {msg.fileUrl && msg.fileType === 'document' && (
                  <Text className={`text-sm mb-1 ${isMine ? 'text-primary-100' : 'text-primary-600'}`}>📄 {msg.fileName}</Text>
                )}
                {msg.text ? <Text className={`text-sm ${isMine ? 'text-white' : 'text-slate-900'}`}>{msg.text}</Text> : null}
                <Text className={`text-xs mt-1 ${isMine ? 'text-primary-200' : 'text-slate-400'}`}>{time}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View className="bg-white border-t border-slate-100 px-3 py-2 flex-row items-center gap-2">
        <TouchableOpacity onPress={pickImage} className="p-2">
          <Text className="text-xl">🖼️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={pickDocument} className="p-2">
          <Text className="text-xl">📎</Text>
        </TouchableOpacity>
        <TextInput value={text} onChangeText={setText} className="flex-1 bg-slate-100 rounded-xl px-3 py-2 text-slate-900 text-sm"
          placeholder="Type a message…" placeholderTextColor="#94a3b8"
          multiline returnKeyType="send" onSubmitEditing={() => handleSend()} />
        <TouchableOpacity onPress={() => handleSend()} disabled={sending || !text.trim()}
          className={`w-9 h-9 rounded-xl items-center justify-center ${text.trim() ? 'bg-primary-600' : 'bg-slate-200'}`}>
          {sending ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold text-lg">→</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
