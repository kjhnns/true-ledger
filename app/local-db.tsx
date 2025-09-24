import { Alert, ScrollView, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { Stack } from 'expo-router';
import { deleteDbFile, getDbFileInfo, initDb, setDbFilePath } from '../lib/db';

function joinDirectoryAndFile(directory: string, fileName: string) {
  const trimmedDirectory = directory.replace(/\/+$/, '');
  const trimmedFileName = fileName.replace(/^\/+/, '');
  return `${trimmedDirectory}/${trimmedFileName}`;
}

async function forceAppReload() {
  try {
    const Updates = await import('expo-updates');
    if (Updates.reloadAsync) {
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    // ignore and fall back
  }
  try {
    const { DevSettings } = await import('react-native');
    if (DevSettings?.reload) {
      DevSettings.reload();
      return true;
    }
  } catch {
    // ignore missing dev settings
  }
  return false;
}

export default function LocalDb() {
  const theme = useTheme();

  const getDbUri = async () => {
    const info = await getDbFileInfo();
    return info.path;
  };

  const handleExport = async () => {
    try {
      const uri = await getDbUri();
      const Sharing = await import('expo-sharing');
      await Sharing.shareAsync(uri);
    } catch {
      Alert.alert('Export failed.');
    }
  };

  const confirmImport = () => {
    Alert.alert(
      'Replace existing database?',
      'Your current data will be overwritten.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            try {
              const DocumentPicker = await import('expo-document-picker');
              const FileSystem = await import('expo-file-system');
              const info = await getDbFileInfo();
              const { assets, canceled } = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: false,
              });
              if (canceled || !assets || assets.length === 0) return;
              if (!info.directory) {
                throw new Error('Database directory unavailable');
              }
              const destination = joinDirectoryAndFile(
                info.directory,
                `imported-${Date.now()}.db`
              );
              await FileSystem.copyAsync({ from: assets[0].uri, to: destination });
              await setDbFilePath(destination);
              Alert.alert('Database imported.');
              const reloaded = await forceAppReload();
              if (!reloaded) {
                Alert.alert(
                  'Restart required',
                  'Please restart the app manually to finish applying the imported database.'
                );
              }
            } catch {
              Alert.alert('Import failed.');
            }
          },
        },
      ]
    );
  };

  const confirmReset = () => {
    Alert.alert(
      'Erase all data?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDbFile();
              await initDb();
              Alert.alert('Database reset.');
            } catch {
              Alert.alert('Reset failed.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
      <Stack.Screen options={{ title: 'Local database' }} />
      <Text variant="headlineSmall" style={{ marginBottom: 12 }}>
        Local database management
      </Text>
      <Text style={{ marginBottom: 16 }}>
        All your transactions and category setup live in a tiny SQLite file on this device. You can export or import that file to move stuff between gadgets. ExpensU never backs it up, so keep your own copy. Your OpenAI key stays in secure storage and is not part of this file.
      </Text>
      <Button mode="outlined" onPress={handleExport} style={{ marginBottom: 8 }}>
        Export database
      </Button>
      <Text style={{ fontSize: 12, color: 'gray', marginBottom: 8 }}>
        Importing will replace your current database.
      </Text>
      <Button mode="outlined" onPress={confirmImport}>
        Import database
      </Button>
      <View style={{ height: 32 }} />
      <Text style={{ color: theme.colors.error, marginBottom: 8 }}>
        This wipes everything. All data will be lost.
      </Text>
      <Button
        mode="contained"
        buttonColor={theme.colors.error}
        onPress={confirmReset}
      >
        Reset database
      </Button>
    </ScrollView>
  );
}

