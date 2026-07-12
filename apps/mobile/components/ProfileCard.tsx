import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { GigProfile, ProfessionalProfile } from '@jobman/shared/src/types';

type Props = {
  profile: GigProfile | ProfessionalProfile;
  onPress: () => void;
};

export default function ProfileCard({ profile, onPress }: Props) {
  const isGig = profile.type === 'gig';
  const gig = profile as GigProfile;
  const pro = profile as ProfessionalProfile;

  return (
    <TouchableOpacity onPress={onPress} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <View className="flex-row items-start gap-3">
        {profile.photoURL ? (
          <Image source={{ uri: profile.photoURL }} className="w-14 h-14 rounded-xl" />
        ) : (
          <View className="w-14 h-14 rounded-xl bg-primary-100 items-center justify-center">
            <Text className="text-primary-700 font-bold text-2xl">{profile.name[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="font-semibold text-slate-900 text-base">{profile.name}</Text>
          <Text className="text-primary-600 text-sm font-medium">{isGig ? gig.category : pro.title}</Text>
          <Text className="text-slate-400 text-xs">{profile.location}</Text>
        </View>
        <View className="items-end">
          {isGig ? (
            <Text className="font-bold text-slate-900">${gig.hourlyRate}<Text className="text-xs font-normal text-slate-400">/hr</Text></Text>
          ) : (
            <Text className="text-xs text-slate-500">{pro.experienceYears}y exp</Text>
          )}
          <View className={`mt-1 px-2 py-0.5 rounded-full ${isGig ? 'bg-orange-100' : 'bg-blue-100'}`}>
            <Text className={`text-xs font-medium ${isGig ? 'text-orange-700' : 'text-blue-700'}`}>
              {isGig ? 'Gig' : 'Pro'}
            </Text>
          </View>
        </View>
      </View>
      <Text className="text-slate-600 text-sm mt-2" numberOfLines={2}>{profile.bio}</Text>
      {profile.skills?.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mt-2">
          {profile.skills.slice(0, 4).map(s => (
            <View key={s} className="px-2 py-0.5 bg-slate-100 rounded-full">
              <Text className="text-slate-600 text-xs">{s}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
