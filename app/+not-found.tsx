import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../src/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Esta tela nao existe.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Voltar ao inicio</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: 16 },
  link: { color: Colors.blue, fontSize: 16 },
  linkText: { textDecorationLine: 'underline' },
});
