import { useCallback, useState } from 'react';
import { ScrollView, View, Alert } from 'react-native';
import { Button, IconButton, List, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { createEntity, deleteEntity, listEntities, Entity } from '../../lib/entities';

export default function IncomeSavingsPage() {
  const [type, setType] = useState<'income' | 'savings'>('income');
  const [label, setLabel] = useState('');
  const [income, setIncome] = useState<Entity[]>([]);
  const [savings, setSavings] = useState<Entity[]>([]);

  const load = useCallback(async () => {
    const [inc, sav] = await Promise.all([
      listEntities('income'),
      listEntities('savings'),
    ]);
    setIncome(inc);
    setSavings(sav);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAdd = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    await createEntity({
      label: trimmed,
      category: type,
      prompt: trimmed,
      parentId: null,
      currency: 'USD',
    });
    setLabel('');
    load();
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert('Delete?', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntity(id);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 16 }}>
      <SegmentedButtons
        value={type}
        onValueChange={(v) => setType(v as 'income' | 'savings')}
        buttons={[
          { value: 'income', label: 'Income' },
          { value: 'savings', label: 'Savings' },
        ]}
      />
      <TextInput
        label="Label"
        value={label}
        onChangeText={setLabel}
        style={{ marginVertical: 8 }}
      />
      <Button mode="contained" onPress={handleAdd} disabled={!label.trim()}>
        Add
      </Button>
      <View style={{ marginTop: 24 }}>
        <Text style={{ marginBottom: 8, fontWeight: 'bold' }}>Income</Text>
        {income.map((item) => (
          <List.Item
            key={item.id}
            title={item.label}
            right={() => (
              <IconButton
                icon="delete"
                onPress={() => confirmDelete(item.id, item.label)}
                accessibilityLabel={`Delete ${item.label}`}
              />
            )}
          />
        ))}
        <View style={{ marginTop: 16 }}>
          <Text style={{ marginBottom: 8, fontWeight: 'bold' }}>Savings</Text>
          {savings.map((item) => (
            <List.Item
              key={item.id}
              title={item.label}
              right={() => (
                <IconButton
                  icon="delete"
                  onPress={() => confirmDelete(item.id, item.label)}
                  accessibilityLabel={`Delete ${item.label}`}
                />
              )}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
