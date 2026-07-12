import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getJob, applyToJob } from '@/lib/firestore';
import { auth } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import type { JobListing } from '@jobman/shared/src/types';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = auth.currentUser;
  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => { getJob(id).then(setJob).finally(() => setLoading(false)); }, [id]);

  async function handleApply() {
    if (!user) { router.push('/(auth)/sign-in'); return; }
    if (!coverLetter.trim()) { Alert.alert('Error', 'Please write a cover letter.'); return; }
    setApplying(true);
    try {
      await applyToJob(id, user.uid, user.displayName ?? user.email ?? 'Anonymous', coverLetter);
      setApplied(true);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setApplying(false); }
  }

  if (loading) return <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!job) return <View className="flex-1 items-center justify-center"><Text className="text-slate-500">Job not found.</Text></View>;

  const posted = job.createdAt ? formatDistanceToNow(new Date((job.createdAt as any).seconds * 1000), { addSuffix: true }) : '';

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="bg-white px-4 pt-14 pb-4 border-b border-slate-100">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-slate-500 text-sm">← Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-slate-900">{job.title}</Text>
        <Text className="text-slate-500 text-sm mt-1">{job.postedByName} · {job.location}</Text>
        <Text className="text-slate-400 text-xs mt-0.5">Posted {posted}</Text>
        <View className="flex-row flex-wrap gap-2 mt-3">
          <View className="px-2 py-1 bg-blue-100 rounded-full"><Text className="text-blue-700 text-xs font-medium">{job.type}</Text></View>
          {job.remote && <View className="px-2 py-1 bg-green-100 rounded-full"><Text className="text-green-700 text-xs font-medium">Remote OK</Text></View>}
          {job.salary && (
            <View className="px-2 py-1 bg-slate-100 rounded-full">
              <Text className="text-slate-700 text-xs font-medium">
                ${job.salary.min.toLocaleString()}–${job.salary.max.toLocaleString()}/{job.salary.period === 'hourly' ? 'hr' : 'yr'}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className="px-4 py-5 gap-5">
        <View>
          <Text className="font-semibold text-slate-900 mb-2">Description</Text>
          <Text className="text-slate-600 text-sm leading-relaxed">{job.description}</Text>
        </View>

        {job.requirements?.length > 0 && (
          <View>
            <Text className="font-semibold text-slate-900 mb-2">Requirements</Text>
            {job.requirements.map((r, i) => (
              <Text key={i} className="text-slate-600 text-sm mb-1">• {r}</Text>
            ))}
          </View>
        )}

        {job.skills?.length > 0 && (
          <View>
            <Text className="font-semibold text-slate-900 mb-2">Skills</Text>
            <View className="flex-row flex-wrap gap-2">
              {job.skills.map(s => (
                <View key={s} className="px-2.5 py-1 bg-primary-50 rounded-full">
                  <Text className="text-primary-700 text-xs font-medium">{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Apply */}
        <View className="bg-white rounded-2xl p-4 border border-slate-100">
          {applied ? (
            <View className="items-center py-4">
              <Text className="text-3xl mb-2">✅</Text>
              <Text className="font-semibold text-slate-900">Application Sent!</Text>
              <Text className="text-slate-500 text-sm mt-1">The employer will message you.</Text>
            </View>
          ) : (
            <>
              <Text className="font-semibold text-slate-900 mb-3">Apply for this Job</Text>
              <TextInput value={coverLetter} onChangeText={setCoverLetter} multiline numberOfLines={5}
                className="border border-slate-200 rounded-xl p-3 text-slate-900 text-sm mb-3"
                style={{ textAlignVertical: 'top', minHeight: 100 }}
                placeholder="Write a brief cover letter or introduction…" placeholderTextColor="#94a3b8" />
              <TouchableOpacity onPress={handleApply} disabled={applying}
                className="bg-primary-600 rounded-xl py-3 items-center">
                {applying ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold">Submit Application</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
