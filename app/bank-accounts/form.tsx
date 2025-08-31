import { useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { BankAccountInput, bankAccountSchema } from '../../lib/entities';
import { SUPPORTED_CURRENCIES } from '../../lib/currencies';

export type Props = {
  initial?: { label: string; prompt: string; currency: string };
  onSubmit: (input: BankAccountInput) => Promise<void>;
  submitLabel: string;
};

export default function BankAccountForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState<string>(initial?.label ?? '');
  const [prompt, setPrompt] = useState<string>(initial?.prompt ?? '');
  const [currency, setCurrency] = useState<string>(
    initial?.currency ?? SUPPORTED_CURRENCIES[2]
  );
  const [error, setError] = useState<string>('');

  const handleSave = async () => {
    const input: BankAccountInput = {
      label: label.trim(),
      prompt: prompt.trim(),
      currency: currency as any,
    };
    const result = bankAccountSchema.safeParse(input);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setError('');
    await onSubmit(result.data);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ marginBottom: 4 }}>Label</Text>
      <TextInput
        value={label}
        onChangeText={setLabel}
        style={{ borderWidth: 1, padding: 8, marginBottom: 12 }}
      />
      <Text style={{ marginBottom: 4 }}>Prompt</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={{ borderWidth: 1, padding: 8, height: 120, marginBottom: 12 }}
      />
      <Text style={{ marginBottom: 4 }}>Currency</Text>
      <TextInput
        value={currency}
        onChangeText={setCurrency}
        autoCapitalize="characters"
        style={{ borderWidth: 1, padding: 8, marginBottom: 12 }}
      />
      {error ? <Text style={{ color: 'red', marginBottom: 12 }}>{error}</Text> : null}
      <Button title={submitLabel} onPress={handleSave} />
    </View>
  );
}
