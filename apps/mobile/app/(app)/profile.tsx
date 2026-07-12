import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { getProfile } from '@/lib/firestore';
import { logout } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import type { GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [profile, setProfile] = useState<GigProfile | ProfessionalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) getProfile(user.uid).then(setProfile).finally(() => setLoading(false));
  }, [user]);

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); } },
    ]);
  }

  if (!user) return null;

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-white px-4 pt-14 pb-6 border-b border-slate-100 items-center">
        {user.photoURL ? (
          <Image source={{ uri: user.photoURL }} className="w-20 h-20 rounded-full mb-3" />
        ) : (
          <View className="w-20 h-20 rounded-full bg-primary-100 items-center justify-center mb-3">
            <Text className="text-primary-700 font-bold text-3xl">{(user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}</Text>
          </View>
        )}
        <Text className="text-xl font-bold text-slate-900">{user.displayName ?? 'User'}</Text>
        <Text className="text-slate-500 text-sm mt-0.5">{user.email}</Text>
        {profile && (
          <View className={`mt-2 px-3 py-1 rounded-full ${profile.type === 'gig' ? 'bg-orange-100' : 'bg-blue-100'}`}>
            <Text className={`text-xs font-semibold ${profile.type === 'gig' ? 'text-orange-700' : 'text-blue-700'}`}>
              {profile.type === 'gig' ? '🔨 Gig Worker' : '💼 Professional'}
            </Text>
          </View>
        )}
      </View>

      <View className="px-4 py-5 gap-3">
        {/* Profile status */}
        {!profile ? (
          <View className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <Text className="font-semibold text-amber-900 mb-1">Complete your profile</Text>
            <Text className="text-amber-700 text-sm mb-3">Create a profile to get discovered by employers.</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity className="flex-1 bg-orange-500 rounded-xl py-2 items-center">
                <Text className="text-white font-semibold text-sm">🔨 Gig Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-primary-600 rounded-xl py-2 items-center">
                <Text className="text-white font-semibold text-sm">💼 Pro Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity className="bg-white rounded-2xl p-4 border border-slate-100 flex-row items-center justify-between">
            <View>
              <Text className="font-semibold text-slate-900">My Public Profile</Text>
              <Text className="text-slate-500 text-sm">{profile.type === 'gig' ? (profile as GigProfile).category : (profile as ProfessionalProfile).title}</Text>
            </View>
            <Text className="text-slate-400 text-lg">›</Text>
          </TouchableOpacity>
        )}

        {/* Menu items */}
        {[
          { icon: '📋', label: 'My Job Listings' },
          { icon: '📨', label: 'My Applications' },
          { icon: '💬', label: 'Messages', onPress: () => router.push('/(app)/messages') },
          { icon: '⚙️', label: 'Settings' },
        ].map(item => (
          <TouchableOpacity key={item.label} onPress={item.onPress}
            className="bg-white rounded-2xl px-4 py-3.5 border border-slate-100 flex-row items-center gap-3">
            <Text className="text-xl">{item.icon}</Text>
            <Text className="flex-1 font-medium text-slate-700">{item.label}</Text>
            <Text className="text-slate-300 text-lg">›</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity onPress={handleLogout}
          className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5 items-center mt-2">
          <Text className="text-red-600 font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
