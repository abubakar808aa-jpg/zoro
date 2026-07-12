import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getProfessionalProfiles } from '@/lib/firestore';
import { PROFESSIONAL_CATEGORIES } from '@jobman/shared/src/constants/categories';
import type { ProfessionalProfile } from '@jobman/shared/src/types';
import ProfileCard from '@/components/ProfileCard';

export default function ProfessionalsScreen() {
  const router = useRouter();
  const { category: initCat } = useLocalSearchParams<{ category?: string }>();
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(initCat ?? '');

  useEffect(() => {
    setLoading(true);
    getProfessionalProfiles(selected || undefined).then(setProfiles).finally(() => setLoading(false));
  }, [selected]);

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-4 pt-14 pb-4 border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-900">Professionals</Text>
        <Text className="text-slate-500 text-sm">Full-time, part-time & contract talent</Text>
      </View>

      <FlatList
        data={[{ id: '', label: 'All', icon: '💼' }, ...PROFESSIONAL_CATEGORIES]}
        horizontal showsHorizontalScrollIndicator={false}
        keyExtractor={i => i.id}
        className="bg-white border-b border-slate-100 py-3 flex-grow-0"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item.id)}
            className={`px-3 py-1.5 rounded-full border ${selected === item.id ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-200'}`}>
            <Text className={`text-sm font-medium ${selected === item.id ? 'text-white' : 'text-slate-600'}`}>
              {item.icon} {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <FlatList
          data={profiles} keyExtractor={p => p.uid}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <ProfileCard profile={item} onPress={() => router.push({ pathname: '/(app)/profile/[id]', params: { id: item.uid } })} />
          )}
          ListEmptyComponent={<View className="items-center py-20"><Text className="text-4xl mb-3">💼</Text><Text className="text-slate-500">No professionals found.</Text></View>}
        />
      )}
    </View>
  );
}
