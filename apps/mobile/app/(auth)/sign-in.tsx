import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { signInWithEmail, signInWithGoogleCredential } from '@/lib/auth';
import { GOOGLE_WEB_CLIENT_ID } from '@jobman/shared/src/firebase/config';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
  });

  async function handleEmail() {
    if (!email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      Alert.alert('Sign In Failed', err.message);
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const response = await promptGoogle();
      if (response?.type === 'success' && response.params.id_token) {
        await signInWithGoogleCredential(response.params.id_token, 'worker');
      }
    } catch (err: any) {
      Alert.alert('Google Sign In Failed', err.message);
    } finally { setLoading(false); }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 justify-center px-6 py-12">
        {/* Logo */}
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primary-600 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">J</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-900">JobMan</Text>
          <Text className="text-slate-500 mt-1">Welcome back</Text>
        </View>

        {/* Google */}
        <TouchableOpacity onPress={handleGoogle} disabled={loading}
          className="flex-row items-center justify-center gap-3 bg-white border border-slate-200 rounded-2xl py-3.5 mb-5">
          <Text className="text-2xl">G</Text>
          <Text className="font-semibold text-slate-700">Continue with Google</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-3 mb-5">
          <View className="flex-1 h-px bg-slate-200" />
          <Text className="text-xs text-slate-400">or sign in with email</Text>
          <View className="flex-1 h-px bg-slate-200" />
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Email</Text>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-white"
              placeholder="you@example.com" placeholderTextColor="#94a3b8" />
          </View>
          <View>
            <Text className="text-sm font-medium text-slate-700 mb-1">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry
              className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-white"
              placeholder="••••••••" placeholderTextColor="#94a3b8" />
          </View>
        </View>

        <TouchableOpacity onPress={handleEmail} disabled={loading}
          className="bg-primary-600 rounded-2xl py-3.5 items-center mt-6">
          {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Sign In</Text>}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-500 text-sm">Don't have an account? </Text>
          <Link href="/(auth)/sign-up" asChild>
            <TouchableOpacity><Text className="text-primary-600 font-semibold text-sm">Sign up</Text></TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
