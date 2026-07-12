import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { signUpWithEmail, signInWithGoogleCredential } from '@/lib/auth';
import { GOOGLE_WEB_CLIENT_ID } from '@jobman/shared/src/firebase/config';
import type { AccountType } from '@jobman/shared/src/types';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [accountType, setAccountType] = useState<AccountType>('worker');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [, , promptGoogle] = Google.useIdTokenAuthRequest({ clientId: GOOGLE_WEB_CLIENT_ID });

  async function handleEmail() {
    if (!name || !email || !password) { Alert.alert('Error', 'Please fill in all fields.'); return; }
    setLoading(true);
    try { await signUpWithEmail(name, email, password, accountType); }
    catch (err: any) { Alert.alert('Sign Up Failed', err.message); }
    finally { setLoading(false); }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const res = await promptGoogle();
      if (res?.type === 'success' && res.params.id_token)
        await signInWithGoogleCredential(res.params.id_token, accountType);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setLoading(false); }
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 justify-center px-6 py-12">
        <View className="items-center mb-10">
          <View className="w-16 h-16 bg-primary-600 rounded-2xl items-center justify-center mb-4">
            <Text className="text-white text-3xl font-bold">J</Text>
          </View>
          <Text className="text-3xl font-bold text-slate-900">Create Account</Text>
          <Text className="text-slate-500 mt-1">Join JobMan — it's free</Text>
        </View>

        {step === 'type' ? (
          <View>
            <Text className="text-sm font-semibold text-slate-700 text-center mb-4">I am joining as a…</Text>
            <View className="gap-3 mb-6">
              {([
                { type: 'worker', icon: '🔨', label: 'Worker / Job Seeker', desc: 'Post my profile, find jobs & gigs' },
                { type: 'employer', icon: '🏢', label: 'Employer / Client', desc: 'Post jobs & hire talent' },
              ] as const).map(opt => (
                <TouchableOpacity key={opt.type} onPress={() => setAccountType(opt.type)}
                  className={`p-4 rounded-2xl border-2 ${accountType === opt.type ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}>
                  <Text className="text-2xl mb-1">{opt.icon}</Text>
                  <Text className="font-semibold text-slate-900">{opt.label}</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setStep('form')} className="bg-primary-600 rounded-2xl py-3.5 items-center">
              <Text className="text-white font-semibold text-base">Continue as {accountType === 'worker' ? 'Worker' : 'Employer'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <TouchableOpacity onPress={() => setStep('type')} className="mb-4">
              <Text className="text-slate-500 text-sm">← Change account type</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGoogle} disabled={loading}
              className="flex-row items-center justify-center gap-3 border border-slate-200 rounded-2xl py-3.5 mb-5 bg-white">
              <Text className="text-xl">G</Text>
              <Text className="font-semibold text-slate-700">Sign up with Google</Text>
            </TouchableOpacity>

            <View className="flex-row items-center gap-3 mb-5">
              <View className="flex-1 h-px bg-slate-200" />
              <Text className="text-xs text-slate-400">or with email</Text>
              <View className="flex-1 h-px bg-slate-200" />
            </View>

            <View className="gap-4">
              {[
                { label: 'Full Name', value: name, setter: setName, placeholder: 'John Smith', type: 'default' },
                { label: 'Email', value: email, setter: setEmail, placeholder: 'you@example.com', type: 'email-address' },
                { label: 'Password', value: password, setter: setPassword, placeholder: 'Min. 6 characters', type: 'default', secure: true },
              ].map(f => (
                <View key={f.label}>
                  <Text className="text-sm font-medium text-slate-700 mb-1">{f.label}</Text>
                  <TextInput value={f.value} onChangeText={f.setter} secureTextEntry={f.secure}
                    keyboardType={f.type as any} autoCapitalize={f.type === 'email-address' ? 'none' : 'words'}
                    className="border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-white"
                    placeholder={f.placeholder} placeholderTextColor="#94a3b8" />
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={handleEmail} disabled={loading}
              className="bg-primary-600 rounded-2xl py-3.5 items-center mt-6">
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Create Account</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-500 text-sm">Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <TouchableOpacity><Text className="text-primary-600 font-semibold text-sm">Sign in</Text></TouchableOpacity>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
