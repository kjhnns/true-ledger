import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from 'react-native';
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
    <View className="flex-row w-20 justify-between">
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
    <View className="flex-1 p-4 pt-12">
      <Button title="Banks" onPress={() => router.push('/bank-accounts')} />
      <Button
        title="Expense categories"
        onPress={() => router.push('/expense-categories')}
      />
      <Button title="Upload Statement" onPress={openUploadModal} />
      <FlatList
        data={statements}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text>No statements</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/statements/${item.id}`)}
            className="flex-row py-2 border-b"
          >
            <Text className="flex-1">{item.bankLabel}</Text>
            <Text className="flex-1">
              {new Date(item.uploadDate).toLocaleDateString()}
            </Text>
            <Text className="w-10 text-center">{item.transactionCount}</Text>
            <StatusRow item={item} />
          </Pressable>
        )}
      />
      <Modal visible={modalVisible} animationType="slide">
        <View className="flex-1 p-4 pt-32">
          <Text className="text-lg mb-2">Select Bank</Text>
          {banks.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setSelectedBank(b.id)}
              className="flex-row py-1"
            >
              <Text className="mr-2">
                {selectedBank === b.id ? '[x]' : '[ ]'}
              </Text>
              <Text>{b.label}</Text>
            </Pressable>
          ))}
          <Button title="Pick PDF" onPress={pickFile} />
          {file && <Text className="my-2">{file.name}</Text>}
          <Button title="Upload" onPress={upload} />
          <Button
            title="Cancel"
            onPress={() => {
              setModalVisible(false);
              setSelectedBank(null);
              setFile(null);
            }}
          />
        </View>
      </Modal>
    </View>
  );
}
