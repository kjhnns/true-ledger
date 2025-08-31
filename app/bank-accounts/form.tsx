import { useState } from 'react';
import { View } from 'react-native';
import { Button, List, Menu, Text, TextInput, useTheme } from 'react-native-paper';
import { SUPPORTED_CURRENCIES } from '../../lib/currencies';
import { BankAccountInput, bankAccountSchema } from '../../lib/entities';

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
  const [menuVisible, setMenuVisible] = useState(false);
  const theme = useTheme();

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
      <List.Section>
        <List.Subheader>Bank details</List.Subheader>
        <Text style={{ marginBottom: 4 }}>Label</Text>
        <TextInput
          mode="outlined"
          value={label}
          onChangeText={setLabel}
          style={{ marginBottom: 12 }}
        />
        <Text style={{ marginBottom: 4 }}>Prompt</Text>
        <TextInput
          mode="outlined"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          style={{ marginBottom: 12, height: 128 }}
        />
        <Text style={{ marginBottom: 4 }}>Currency</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button mode="outlined" onPress={() => setMenuVisible(true)} style={{ marginBottom: 12 }}>
              {currency}
            </Button>
          }
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <Menu.Item
              key={c}
              onPress={() => {
                setCurrency(c);
                setMenuVisible(false);
              }}
              title={c}
            />
          ))}
        </Menu>
      </List.Section>

      <View style={{ marginTop: 12 }}>
        {error ? (
          <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
        ) : null}
        <Button mode="contained" onPress={handleSave}>
          {submitLabel}
        </Button>
      </View>
    </View>
  );
}
