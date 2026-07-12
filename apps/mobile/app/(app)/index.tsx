import { ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { auth } from '@/lib/firebase';
import { GIG_CATEGORIES, PROFESSIONAL_CATEGORIES } from '@jobman/shared/src/constants/categories';

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  return (
    <ScrollView className="flex-1 bg-slate-50">
      {/* Header */}
      <View className="bg-primary-600 px-5 pt-14 pb-8">
        <Text className="text-white text-sm opacity-80">Good morning 👋</Text>
        <Text className="text-white text-2xl font-bold mt-1">{user?.displayName?.split(' ')[0] ?? 'Welcome'}</Text>
        <Text className="text-primary-100 text-sm mt-1">What are you looking for today?</Text>
      </View>

      {/* Quick Actions */}
      <View className="flex-row gap-3 px-4 py-4">
        {[
          { icon: '🔨', label: 'Hire a\nGig Worker', route: '/(app)/gigs' },
          { icon: '💼', label: 'Browse\nJobs', route: '/(app)/jobs' },
          { icon: '👥', label: 'Find\nProfessionals', route: '/(app)/professionals' },
        ].map(a => (
          <TouchableOpacity key={a.label} onPress={() => router.push(a.route as any)}
            className="flex-1 bg-white rounded-2xl p-4 items-center shadow-sm border border-slate-100">
            <Text className="text-3xl mb-2">{a.icon}</Text>
            <Text className="text-xs font-semibold text-slate-700 text-center">{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Gig Categories */}
      <View className="px-4 mt-2">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-slate-900">Gig Services</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/gigs')}>
            <Text className="text-primary-600 text-sm font-semibold">View all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
          {GIG_CATEGORIES.slice(0, 8).map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => router.push({ pathname: '/(app)/gigs', params: { category: cat.id } })}
              className="items-center bg-white rounded-2xl p-4 mr-3 w-20 border border-slate-100">
              <Text className="text-2xl mb-1">{cat.icon}</Text>
              <Text className="text-xs text-slate-600 text-center font-medium" numberOfLines={2}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Professional Categories */}
      <View className="px-4 mt-6 mb-8">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-slate-900">Professional Jobs</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/professionals')}>
            <Text className="text-primary-600 text-sm font-semibold">View all</Text>
          </TouchableOpacity>
        </View>
        <View className="gap-2">
          {PROFESSIONAL_CATEGORIES.slice(0, 4).map(cat => (
            <TouchableOpacity key={cat.id} onPress={() => router.push({ pathname: '/(app)/professionals', params: { category: cat.id } })}
              className="flex-row items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-100">
              <Text className="text-xl">{cat.icon}</Text>
              <Text className="text-sm font-medium text-slate-700">{cat.label}</Text>
              <Text className="ml-auto text-slate-300">›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
