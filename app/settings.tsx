import { useEffect, useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
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
      <View className="flex-1 p-5 justify-center">
        <Text className="mb-2">OpenAI API key</Text>
        <TextInput
          secureTextEntry
          placeholder="sk-..."
          value={input}
          onChangeText={(text) => {
            setInput(text);
            if (error) setError("");
          }}
          className="border p-2 mb-2 rounded"
        />
        {error ? <Text className="text-red-500 mb-2">{error}</Text> : null}
        <Button
          title={hasKey ? "Save new key" : "Save key"}
          onPress={handleSave}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 p-5 justify-center">
      <Text className="mb-2">OpenAI API key</Text>
      <Text className="mb-4">
        Key saved • Last updated {formatDate(updatedAt)}
      </Text>
      <Button title="Replace key" onPress={() => setEditing(true)} />
      <View className="h-2" />
      <Button title="Remove key" onPress={handleRemove} />
    </View>
  );
}

