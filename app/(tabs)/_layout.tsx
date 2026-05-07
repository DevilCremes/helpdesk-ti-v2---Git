import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60;
  const totalHeight = tabBarHeight + (insets.bottom > 0 ? insets.bottom : 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor:  Colors.border,
          height: totalHeight,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 4,
        },
        tabBarActiveTintColor:   Colors.blue,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, marginBottom: 2 },
      }}
    >
      <Tabs.Screen name="index"     options={{ title: 'Chamados',  tabBarIcon: ({ color }) => <MaterialCommunityIcons name="ticket-outline"        size={24} color={color} /> }} />
      <Tabs.Screen name="tarefas" options={{ title: 'Tarefas', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="checkbox-marked-outline" size={24} color={color} /> }} />
      <Tabs.Screen name="stats"     options={{ title: 'Relatorio', tabBarIcon: ({ color }) => <MaterialCommunityIcons name="chart-bar"               size={24} color={color} /> }} />
      <Tabs.Screen name="config"    options={{ title: 'Config',    tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog-outline"             size={24} color={color} /> }} />
    </Tabs>
  );
}
