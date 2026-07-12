import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#94a3b8',
      tabBarStyle: { borderTopColor: '#f1f5f9', paddingBottom: 4 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{
        title: 'Home',
        tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="gigs" options={{
        title: 'Gig Workers',
        tabBarIcon: ({ color, size }) => <Ionicons name="hammer-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="professionals" options={{
        title: 'Professionals',
        tabBarIcon: ({ color, size }) => <Ionicons name="school-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="jobs" options={{
        title: 'Jobs',
        tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="messages" options={{
        title: 'Messages',
        tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
      }} />
    </Tabs>
  );
}
