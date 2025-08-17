import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { BankAccountInput, bankAccountSchema, listBankAccounts } from '../../lib/bankAccounts';
import { generateClassificationKey } from '../../lib/classification';

type Props = {
  initial?: { label: string; prompt: string; classificationKey: string };
  onSubmit: (input: BankAccountInput) => Promise<void>;
  submitLabel: string;
};

export default function BankAccountForm({ initial, onSubmit, submitLabel }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [classificationKey, setClassificationKey] = useState('');
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const accounts = await listBankAccounts();
      const keys = new Set(accounts.map((a) => a.classificationKey));
      if (initial?.classificationKey) keys.delete(initial.classificationKey);
      setExistingKeys(keys);
    })();
  }, [initial]);

  useEffect(() => {
    setClassificationKey(generateClassificationKey(label, new Set(existingKeys)));
  }, [label, existingKeys]);

  const handleSave = async () => {
    const input: BankAccountInput = {
      label: label.trim(),
      prompt: prompt.trim(),
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
      <Text style={{ marginBottom: 4 }}>Classification key</Text>
      <TextInput
        value={classificationKey}
        editable={false}
        style={{ borderWidth: 1, padding: 8, marginBottom: 4, color: '#666' }}
      />
      <Text style={{ fontSize: 12, marginBottom: 12, color: '#666' }}>
        Used to classify transactions.
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
