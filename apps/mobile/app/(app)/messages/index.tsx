import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { subscribeToConversations } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '@jobman/shared/src/types';

export default function MessagesScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToConversations(user.uid, setConversations);
  }, [user]);

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-4 pt-14 pb-4 border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Messages</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: conv }) => {
          const otherId = conv.participants.find(p => p !== user?.uid) ?? '';
          const otherName = conv.participantNames?.[otherId] ?? 'User';
          const otherPhoto = conv.participantPhotos?.[otherId];
          const isUnread = conv.lastSenderId !== user?.uid;
          const timeAgo = conv.lastMessageAt
            ? formatDistanceToNow(new Date((conv.lastMessageAt as any).seconds * 1000), { addSuffix: true }) : '';

          return (
            <TouchableOpacity onPress={() => router.push({ pathname: '/(app)/messages/[id]', params: { id: conv.id } })}
              className={`flex-row items-center gap-3 p-4 rounded-2xl border ${isUnread ? 'bg-primary-50 border-primary-100' : 'bg-white border-slate-100'}`}>
              {otherPhoto ? (
                <Image source={{ uri: otherPhoto }} className="w-12 h-12 rounded-full" />
              ) : (
                <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center">
                  <Text className="text-primary-700 font-bold text-lg">{otherName[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className={`font-semibold ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>{otherName}</Text>
                  <Text className="text-slate-400 text-xs">{timeAgo}</Text>
                </View>
                <Text className={`text-sm mt-0.5 ${isUnread ? 'text-slate-700 font-medium' : 'text-slate-500'}`} numberOfLines={1}>
                  {conv.lastSenderId === user?.uid ? 'You: ' : ''}{conv.lastMessage || 'No messages yet'}
                </Text>
              </View>
              {isUnread && conv.lastMessage && <View className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">💬</Text>
            <Text className="text-slate-500 font-medium">No conversations yet.</Text>
            <Text className="text-slate-400 text-sm mt-1">Browse profiles to start one.</Text>
          </View>
        }
      />
    </View>
  );
}
