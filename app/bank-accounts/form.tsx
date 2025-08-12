import { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { BankAccountInput, bankAccountSchema } from '../../lib/bankAccounts';

type Props = {
  initial?: { label: string; prompt: string };
  onSubmit: (input: BankAccountInput) => Promise<void>;
  submitLabel: string;
};

export default function BankAccountForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [classificationKey, setClassificationKey] = useState('');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    const input: BankAccountInput = {
      label: label.trim(),
      prompt: prompt.trim(),
    };
    const trimmedKey = classificationKey.trim();
    if (trimmedKey) input.classificationKey = trimmedKey;
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
      <Text style={{ marginBottom: 4 }}>Classification key</Text>
      <TextInput
        value={classificationKey}
        onChangeText={setClassificationKey}
        secureTextEntry
        style={{ borderWidth: 1, padding: 8, marginBottom: 4 }}
      />
      <Text style={{ fontSize: 12, marginBottom: 12 }}>
        This key is stored securely on-device and never shown in plain text.
      </Text>
      <Text style={{ marginBottom: 4 }}>Prompt</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        multiline
        style={{ borderWidth: 1, padding: 8, height: 120, marginBottom: 12 }}
      />
      {error ? <Text style={{ color: 'red', marginBottom: 12 }}>{error}</Text> : null}
      <Button title={submitLabel} onPress={handleSave} />
    </View>
  );
}
