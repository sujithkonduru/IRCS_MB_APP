import { Stack } from 'expo-router';

export default function EmployeeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="request-details/[id]" options={{ headerShown: true, title: 'Request Details' }} />
      <Stack.Screen name="permission-details/[id]" options={{ headerShown: true, title: 'Permission Pass' }} />
    </Stack>
  );
}