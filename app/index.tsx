import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { Button, DataTable, RadioButton, Text } from 'react-native-paper';
import { loadBanksForModal } from '../lib/banks';
import { Entity } from '../lib/entities';
import {
  createDummyStatementWithTransactions,
  listStatementsWithMeta,
  StatementMeta,
} from '../lib/statements';

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
      {statements.length === 0 ? (
        <Text>No statements</Text>
      ) : (
        <ScrollView>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Bank</DataTable.Title>
              <DataTable.Title>Upload Date</DataTable.Title>
              <DataTable.Title numeric>Txns</DataTable.Title>
              <DataTable.Title>Progress</DataTable.Title>
            </DataTable.Header>
            {statements.map((item) => (
              <DataTable.Row
                key={item.id}
                onPress={() => router.push(`/statements/${item.id}`)}
              >
                <DataTable.Cell>{item.bankLabel}</DataTable.Cell>
                <DataTable.Cell>
                  {new Date(item.uploadDate).toLocaleDateString()}
                </DataTable.Cell>
                <DataTable.Cell numeric>{item.transactionCount}</DataTable.Cell>
                <DataTable.Cell style={{ width: 80 }}>
                  <StatusRow item={item} />
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </ScrollView>
      )}
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, padding: 16, paddingTop: 128 }}>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>Select Bank</Text>
          <RadioButton.Group
            onValueChange={(value) => setSelectedBank(value)}
            value={selectedBank ?? ''}
          >
            {banks.map((b) => (
              <RadioButton.Item key={b.id} label={b.label} value={b.id} />
            ))}
          </RadioButton.Group>
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
