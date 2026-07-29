// app/recipe/[id].tsx
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function RecipeScreen() {
  // id comes from the path (/recipe/123), match from the query string (?match=87)
  const { id, match } = useLocalSearchParams<{ id: string; match?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recipe {id}</Text>
      {match && <Text>Match score: {match}%</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
});