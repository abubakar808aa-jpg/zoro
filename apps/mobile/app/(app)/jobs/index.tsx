import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getJobs } from '@/lib/firestore';
import type { JobListing } from '@jobman/shared/src/types';
import { formatDistanceToNow } from 'date-fns';

const TYPES = [
  { id: '', label: 'All' }, { id: 'fulltime', label: 'Full-Time' },
  { id: 'parttime', label: 'Part-Time' }, { id: 'contract', label: 'Contract' }, { id: 'gig', label: 'Gig' },
];

function JobRow({ job, onPress }: { job: JobListing; onPress: () => void }) {
  const posted = job.createdAt ? formatDistanceToNow(new Date((job.createdAt as any).seconds * 1000), { addSuffix: true }) : '';
  return (
    <TouchableOpacity onPress={onPress} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-semibold text-slate-900 text-base" numberOfLines={1}>{job.title}</Text>
          <Text className="text-slate-500 text-xs mt-0.5">{job.postedByName} · {job.location}</Text>
        </View>
        {job.salary && (
          <Text className="font-bold text-slate-900 text-sm flex-shrink-0">
            ${job.salary.min.toLocaleString()}+
          </Text>
        )}
      </View>
      <Text className="text-slate-600 text-sm mt-2" numberOfLines={2}>{job.description}</Text>
      <View className="flex-row items-center gap-2 mt-3">
        <View className="px-2 py-0.5 rounded-full bg-blue-100">
          <Text className="text-blue-700 text-xs font-medium">{job.type}</Text>
        </View>
        <Text className="text-slate-400 text-xs">{job.applicantCount} applicants</Text>
        <Text className="text-slate-400 text-xs ml-auto">{posted}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getJobs(typeFilter ? { type: typeFilter } : undefined).then(setJobs).finally(() => setLoading(false));
  }, [typeFilter]);

  const filtered = search ? jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase())) : jobs;

  return (
    <View className="flex-1 bg-slate-50">
      <View className="bg-white px-4 pt-14 pb-4">
        <Text className="text-xl font-bold text-slate-900">Job Listings</Text>
        <View className="flex-row items-center mt-3 bg-slate-100 rounded-xl px-3 py-2">
          <Text className="text-slate-400 mr-2">🔍</Text>
          <TextInput value={search} onChangeText={setSearch} className="flex-1 text-slate-900 text-sm"
            placeholder="Search jobs…" placeholderTextColor="#94a3b8" />
        </View>
      </View>

      <FlatList
        data={TYPES} horizontal showsHorizontalScrollIndicator={false}
        keyExtractor={t => t.id}
        className="bg-white border-b border-slate-100 py-3 flex-grow-0"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setTypeFilter(item.id)}
            className={`px-3 py-1.5 rounded-full border ${typeFilter === item.id ? 'bg-primary-600 border-primary-600' : 'bg-white border-slate-200'}`}>
            <Text className={`text-sm font-medium ${typeFilter === item.id ? 'text-white' : 'text-slate-600'}`}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : (
        <FlatList
          data={filtered} keyExtractor={j => j.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <JobRow job={item} onPress={() => router.push({ pathname: '/(app)/jobs/[id]', params: { id: item.id } })} />
          )}
          ListEmptyComponent={<View className="items-center py-20"><Text className="text-4xl mb-3">📋</Text><Text className="text-slate-500">No jobs found.</Text></View>}
        />
      )}
    </View>
  );
}
