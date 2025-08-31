import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
import * as SecureStore from "expo-secure-store";

const STORAGE_KEY = "openai_api_key";
const UPDATED_AT_KEY = "openai_api_key_updated_at";

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export default function Settings() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const existing = await SecureStore.getItemAsync(STORAGE_KEY);
      const updated = await SecureStore.getItemAsync(UPDATED_AT_KEY);
      setHasKey(!!existing);
      setUpdatedAt(updated);
    })();
  }, []);

  const handleSave = async () => {
    const value = input.trim();
    if (!value.startsWith("sk-") || value.length < 20) {
      setError("That doesn’t look like an OpenAI key.");
      return;
    }
    await SecureStore.setItemAsync(STORAGE_KEY, value);
    const iso = new Date().toISOString();
    await SecureStore.setItemAsync(UPDATED_AT_KEY, iso);
    setHasKey(true);
    setUpdatedAt(iso);
    setInput("");
    setEditing(false);
    setError("");
    Alert.alert(hasKey ? "Key updated." : "Key saved securely.");
  };

  const handleRemove = () => {
    Alert.alert("Remove key?", "Are you sure you want to remove the stored key?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await SecureStore.deleteItemAsync(STORAGE_KEY);
          await SecureStore.deleteItemAsync(UPDATED_AT_KEY);
          setHasKey(false);
          setUpdatedAt(null);
          setInput("");
          setEditing(false);
          Alert.alert("Key removed.");
        },
      },
    ]);
  };

  if (!hasKey || editing) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Text style={{ marginBottom: 8 }}>OpenAI API key</Text>
        <TextInput
          mode="outlined"
          secureTextEntry
          placeholder="sk-..."
          value={input}
          onChangeText={(text) => {
            setInput(text);
            if (error) setError("");
          }}
          style={{ marginBottom: 8 }}
        />
        {error ? (
          <Text style={{ color: theme.colors.error, marginBottom: 8 }}>{error}</Text>
        ) : null}
        <Button mode="contained" onPress={handleSave}>
          {hasKey ? 'Save new key' : 'Save key'}
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ marginBottom: 8 }}>OpenAI API key</Text>
      <Text style={{ marginBottom: 16 }}>
        Key saved • Last updated {formatDate(updatedAt)}
      </Text>
      <Button mode="contained" onPress={() => setEditing(true)}>
        Replace key
      </Button>
      <View style={{ height: 8 }} />
      <Button onPress={handleRemove}>Remove key</Button>
    </View>
  );
}

