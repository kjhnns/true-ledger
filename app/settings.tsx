import { useEffect, useState } from "react";
import { Alert, ScrollView, View, Keyboard } from "react-native";
import {
  Button,
  Divider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import * as SecureStore from "expo-secure-store";
import { Stack, useRouter } from "expo-router";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_LEARN_PROMPT,
  OPENAI_KEY_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  LEARN_PROMPT_STORAGE_KEY,
} from "../lib/openai";
import { DEFAULT_SHARED_PERCENT, getDefaultSharedPercent, setDefaultSharedPercent } from "../lib/settings";

const UPDATED_AT_KEY = "openai_api_key_updated_at";

function formatDate(dateString: string | null) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function ManageButtons() {
  const router = useRouter();
  return (
    <View>
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        Manage categories
      </Text>
      <Button
        mode="outlined"
        onPress={() => router.push('/bank-accounts')}
        style={{ marginBottom: 8 }}
      >
        Manage bank accounts
      </Button>
      <Button
        mode="outlined"
        onPress={() => router.push('/expense-categories')}
        style={{ marginBottom: 8 }}
      >
        Manage expense categories
      </Button>
      <Button mode="outlined" onPress={() => router.push('/income-savings')}>
        Manage income & savings
      </Button>
    </View>
  );
}

export default function Settings() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [learnPrompt, setLearnPrompt] = useState("");
  const [sharedPercent, setSharedPercent] = useState<number>(DEFAULT_SHARED_PERCENT);
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      const existing = await SecureStore.getItemAsync(OPENAI_KEY_STORAGE_KEY);
      const updated = await SecureStore.getItemAsync(UPDATED_AT_KEY);
      const storedPrompt = await SecureStore.getItemAsync(
        SYSTEM_PROMPT_STORAGE_KEY
      );
      const storedLearnPrompt = await SecureStore.getItemAsync(
        LEARN_PROMPT_STORAGE_KEY
      );
      const percent = await getDefaultSharedPercent();
      setHasKey(!!existing);
      setUpdatedAt(updated);
      setPrompt(storedPrompt ?? DEFAULT_SYSTEM_PROMPT);
      setLearnPrompt(storedLearnPrompt ?? DEFAULT_LEARN_PROMPT);
      setSharedPercent(percent);
    })();
  }, []);

  const handleSave = async () => {
    const value = input.trim();
    if (!value.startsWith("sk-") || value.length < 20) {
      setError("That doesn’t look like an OpenAI key.");
      return;
    }
    await SecureStore.setItemAsync(OPENAI_KEY_STORAGE_KEY, value);
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
          await SecureStore.deleteItemAsync(OPENAI_KEY_STORAGE_KEY);
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

  const handlePromptSave = async () => {
    await SecureStore.setItemAsync(SYSTEM_PROMPT_STORAGE_KEY, prompt);
    await SecureStore.setItemAsync(LEARN_PROMPT_STORAGE_KEY, learnPrompt);
    await setDefaultSharedPercent(sharedPercent);
    Alert.alert('Settings saved.');
  };

  const renderKeySection = () => {
    if (!hasKey || editing) {
      return (
        <View>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>
            OpenAI API key
          </Text>
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
            <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
              {error}
            </Text>
          ) : null}
          <Button mode="outlined" onPress={handleSave}>
            {hasKey ? 'Save new key' : 'Save key'}
          </Button>
        </View>
      );
    }

    return (
      <View>
        <Text variant="titleMedium" style={{ marginBottom: 8 }}>
          OpenAI API key
        </Text>
        <Text style={{ marginBottom: 16 }}>
          Key saved • Last updated {formatDate(updatedAt)}
        </Text>
        <Button mode="outlined" onPress={() => setEditing(true)}>
          Replace key
        </Button>
        <View style={{ height: 8 }} />
        <Button mode="outlined" onPress={handleRemove}>Remove key</Button>
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ManageButtons />
      <Divider style={{ marginVertical: 16 }} />
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        System prompt
      </Text>
      <TextInput
        mode="outlined"
        multiline
        value={prompt}
        onChangeText={setPrompt}
        style={{ marginBottom: 8 }}
      />
      <Button mode="outlined" onPress={() => Keyboard.dismiss()} style={{ marginBottom: 8 }}>
        Dismiss keyboard
      </Button>
      <Divider style={{ marginVertical: 16 }} />
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        Learn mode prompt
      </Text>
      <TextInput
        mode="outlined"
        multiline
        value={learnPrompt}
        onChangeText={setLearnPrompt}
        style={{ marginBottom: 8 }}
      />
      <Divider style={{ marginVertical: 16 }} />
      <Text variant="titleMedium" style={{ marginBottom: 8 }}>
        Default shared percentage
      </Text>
      <TextInput
        mode="outlined"
        keyboardType="numeric"
        value={String(sharedPercent)}
        onChangeText={(t) => setSharedPercent(Number(t) || 0)}
        style={{ marginBottom: 4 }}
      />
      <Text style={{ fontSize: 12, color: 'gray', marginBottom: 8 }}>
        This will be the default shared value for all entries created.
      </Text>
      <Button mode="outlined" onPress={handlePromptSave}>Save settings</Button>
      <Divider style={{ marginVertical: 16 }} />
      {renderKeySection()}
    </ScrollView>
  );
}

