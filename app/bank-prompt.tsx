import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import { getEntity, updateBankAccount } from '../lib/entities';
import { Currency } from '../lib/currencies';

export default function EditBankPrompt() {
  const { bankId } = useLocalSearchParams<{ bankId: string }>();
  const [label, setLabel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');

  useEffect(() => {
    (async () => {
      if (!bankId) return;
      const bank = await getEntity(bankId);
      if (bank) {
        setLabel(bank.label);
        setPrompt(bank.prompt ?? '');
        setCurrency(bank.currency);
      }
    })();
  }, [bankId]);

  const save = async () => {
    if (!bankId) return;
    await updateBankAccount(bankId, { label, prompt, currency });
    router.back();
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ marginBottom: 4 }}>Bank</Text>
      <TextInput mode="outlined" value={label} editable={false} style={{ marginBottom: 12 }} />
      <Text style={{ marginBottom: 4 }}>Prompt</Text>
      <TextInput
        mode="outlined"
        multiline
        value={prompt}
        onChangeText={setPrompt}
        style={{ marginBottom: 12, height: 128 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Button onPress={() => router.back()} style={{ marginRight: 8 }}>
          Cancel
        </Button>
        <Button mode="contained" onPress={save}>
          Save
        </Button>
      </View>
    </View>
  );
}

