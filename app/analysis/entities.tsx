import { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Button, Chip, List, Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { listEntities, Entity } from '../../lib/entities';
import { buildRouteParams } from './routeParams';

export default function AnalysisEntities() {
  const { type, selected, income, savings } = useLocalSearchParams<{
    type: string;
    selected?: string;
    income?: string;
    savings?: string;
  }>();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const theme = useTheme();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (!type) return;
      const list = await listEntities(type as any);
      setEntities(list);
      if (selected) {
        setCurrent(String(selected).split(',').filter((s) => s));
      } else {
        setCurrent(list.map((e) => e.id));
      }
    })();
  }, [type, selected]);

  const toggle = (id: string) => {
    setCurrent((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    if (!type) return;
    const params = buildRouteParams(type, current, { income, savings });
    router.replace({ pathname: '/analysis', params });
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        paddingBottom: 32,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text variant="headlineMedium">Define {type}</Text>
      <Text>Entities that sum to the metric</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {current.map((id) => {
          const ent = entities.find((e) => e.id === id);
          if (!ent) return null;
          return (
            <Chip key={id} onPress={() => toggle(id)} style={{ margin: 4 }}>
              {ent.label}
            </Chip>
          );
        })}
      </View>
      <Text style={{ marginTop: 16, fontWeight: 'bold' }}>Select entities for metric</Text>
      <ScrollView style={{ flex: 1, marginTop: 8 }}>
        {entities.map((ent) => (
          <List.Item key={ent.id} title={ent.label} onPress={() => toggle(ent.id)} />
        ))}
      </ScrollView>
      <Button
        mode="contained"
        onPress={handleSave}
        style={{ marginTop: 16, marginBottom: 16 }}
      >
        Save
      </Button>
    </View>
  );
}
