import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Entity } from '../lib/entities';
import {
  createDummyStatementWithTransactions,
  listStatementsWithMeta,
  StatementMeta,
} from '../lib/statements';
import { loadBanksForModal } from '../lib/banks';

function StatusRow({ item }: { item: StatementMeta }) {
  const statuses = [
    { checked: true },
    { checked: item.processedAt !== null },
    { checked: item.reviewedAt !== null },
    { checked: item.publishedAt !== null },
  ];
  return (
    <View
      style={{ flexDirection: 'row', width: 80, justifyContent: 'space-between' }}
    >
      {statuses.map((s, i) => (
        <Text key={i}>{s.checked ? '[x]' : '[ ]'}</Text>
      ))}
    </View>
  );
}

export default function Index() {
  const router = useRouter();
  const [statements, setStatements] = useState<StatementMeta[]>([]);
  const [banks, setBanks] = useState<Entity[]>([]);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    (async () => {
      const list = await listStatementsWithMeta();
      setStatements(list);
    })();
  }, []);

  const refreshStatements = async () => {
    const list = await listStatementsWithMeta();
    setStatements(list);
  };

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });
    if (!res.canceled) {
      setFile(res.assets[0]);
    }
  };

  const upload = async () => {
    if (!selectedBank || !file) return;
    await createDummyStatementWithTransactions(selectedBank, file.name);
    await refreshStatements();
    setModalVisible(false);
    setSelectedBank(null);
    setFile(null);
  };

  const openUploadModal = async () => {
    await loadBanksForModal(setBanks, setModalVisible);
  };

  return (
    <View style={{ flex: 1, padding: 16, paddingTop: 48 }}>
      <Button onPress={() => router.push('/bank-accounts')}>Banks</Button>
      <Button onPress={() => router.push('/expense-categories')}>
        Expense categories
      </Button>
      <Button onPress={openUploadModal}>Upload Statement</Button>
      <FlatList
        data={statements}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text>No statements</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/statements/${item.id}`)}
            style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1 }}
          >
            <Text style={{ flex: 1 }}>{item.bankLabel}</Text>
            <Text style={{ flex: 1 }}>
              {new Date(item.uploadDate).toLocaleDateString()}
            </Text>
            <Text style={{ width: 40, textAlign: 'center' }}>
              {item.transactionCount}
            </Text>
            <StatusRow item={item} />
          </Pressable>
        )}
      />
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, padding: 16, paddingTop: 128 }}>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>Select Bank</Text>
          {banks.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setSelectedBank(b.id)}
              style={{ flexDirection: 'row', paddingVertical: 4 }}
            >
              <Text style={{ marginRight: 8 }}>
                {selectedBank === b.id ? '[x]' : '[ ]'}
              </Text>
              <Text>{b.label}</Text>
            </Pressable>
          ))}
          <Button onPress={pickFile}>Pick PDF</Button>
          {file && <Text style={{ marginVertical: 8 }}>{file.name}</Text>}
          <Button onPress={upload}>Upload</Button>
          <Button
            onPress={() => {
              setModalVisible(false);
              setSelectedBank(null);
              setFile(null);
            }}
          >
            Cancel
          </Button>
        </View>
      </Modal>
    </View>
  );
}
