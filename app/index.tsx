import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function Index() {
  const { token, user } = useAuthStore();

  // Instantly evaluate where the user belongs when they hit the root "/"
  if (!token) {
    return <Redirect href="/(login)" />;
  }

  if (user?.Role === 'head') {
    return <Redirect href="/(head)/(tabs)" />;
  }

  // Default to employee if token exists
  return <Redirect href="/(employee)/(tabs)" />;
}