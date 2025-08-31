import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { BottomNavigation, Button, DataTable, Dialog, FAB, IconButton, Portal, RadioButton, SegmentedButtons, Text } from 'react-native-paper';
import { loadBanksForModal } from '../lib/banks';
import { Entity } from '../lib/entities';
import { archiveStatement, createDummyStatementWithTransactions, deleteStatement, listStatementsWithMeta, reprocessStatement, StatementMeta, unarchiveStatement } from '../lib/statements';
import Settings from './settings';

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
        <MaterialCommunityIcons
          key={i}
          name={s.checked ? 'check-circle' : 'checkbox-blank-circle-outline'}
          size={16}
          color={s.checked ? 'green' : 'gray'}
        />
      ))}
    </View>
  );
}

export default function Index() {
  const router = useRouter();
  const [navIndex, setNavIndex] = useState(0);
  const [navRoutes] = useState([
    { key: 'statements', title: 'Statements', icon: 'file-document' },
    { key: 'manage', title: 'Manage', icon: 'folder' },
    { key: 'settings', title: 'Settings', icon: 'cog' },
  ]);
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

  const StatementsRoute = () => {
    const [viewArchived, setViewArchived] = useState<'current' | 'archived'>('current');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    const sorted = statements.slice().sort((a, b) => b.uploadDate - a.uploadDate);
    const filtered = sorted.filter((s) =>
      viewArchived === 'archived' ? s.archivedAt !== null : s.archivedAt === null
    );

    return (
      <View style={{ flex: 1, padding: 16, paddingTop: 48 }}>

        <SegmentedButtons
          value={viewArchived}
          onValueChange={(v) => setViewArchived(v as 'current' | 'archived')}
          buttons={[{ value: 'current', label: 'Current' }, { value: 'archived', label: 'Archived' }]}
          style={{ marginBottom: 12 }}
        />

        {filtered.length === 0 ? (
          <Text>No statements</Text>
        ) : (
          <ScrollView>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Created</DataTable.Title>
                <DataTable.Title>Bank</DataTable.Title>
                <DataTable.Title>File</DataTable.Title>
                <DataTable.Title numeric>Txns</DataTable.Title>
                <DataTable.Title>Status: New</DataTable.Title>
                <DataTable.Title>Status: Processed</DataTable.Title>
                <DataTable.Title>Status: Reviewed</DataTable.Title>
                <DataTable.Title>Status: Published</DataTable.Title>
                <DataTable.Title>Actions</DataTable.Title>
              </DataTable.Header>
              {filtered.map((item) => (
                <DataTable.Row key={item.id} onPress={() => router.push(`/statements/${item.id}`)}>
                  <DataTable.Cell>{new Date(item.uploadDate).toLocaleDateString()}</DataTable.Cell>
                  <DataTable.Cell>{item.bankLabel}</DataTable.Cell>
                  <DataTable.Cell>{item.file ?? '-'}</DataTable.Cell>
                  <DataTable.Cell numeric>{item.transactionCount}</DataTable.Cell>
                  <DataTable.Cell>
                    <MaterialCommunityIcons name={item.status === 'new' ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} color={item.status === 'new' ? 'green' : 'gray'} />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <MaterialCommunityIcons name={item.processedAt ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} color={item.processedAt ? 'green' : 'gray'} />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <MaterialCommunityIcons name={item.reviewedAt ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} color={item.reviewedAt ? 'green' : 'gray'} />
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <MaterialCommunityIcons name={item.publishedAt ? 'check-circle' : 'checkbox-blank-circle-outline'} size={18} color={item.publishedAt ? 'green' : 'gray'} />
                  </DataTable.Cell>
                  <DataTable.Cell style={{ flexDirection: 'row' }}>
                    <IconButton icon="autorenew" size={20} onPress={async () => { await reprocessStatement(item.id); await refreshStatements(); }} accessibilityLabel={`Reprocess statement ${item.id}`} />
                    <IconButton icon={viewArchived === 'archived' ? 'archive-arrow-up' : 'archive'} size={20} onPress={async () => { if (viewArchived === 'archived') { await unarchiveStatement(item.id); } else { await archiveStatement(item.id); } await refreshStatements(); }} accessibilityLabel={viewArchived === 'archived' ? `Unarchive statement ${item.id}` : `Archive statement ${item.id}`} />
                    <IconButton icon="delete" size={20} onPress={() => { setDeleteTarget(item.id); setConfirmVisible(true); }} accessibilityLabel={`Delete statement ${item.id}`} />
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable>
          </ScrollView>
        )}

        <Portal>
          <Dialog visible={confirmVisible} onDismiss={() => setConfirmVisible(false)}>
            <Dialog.Title>Confirm delete</Dialog.Title>
            <Dialog.Content>
              <Text>Are you sure you want to permanently delete this statement?</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setConfirmVisible(false)}>Cancel</Button>
              <Button onPress={async () => {
                if (deleteTarget) {
                  await deleteStatement(deleteTarget);
                  setDeleteTarget(null);
                  setConfirmVisible(false);
                  await refreshStatements();
                }
              }}>Delete</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Modal visible={modalVisible} animationType="slide">
          <View style={{ flex: 1, padding: 16, paddingTop: 128 }}>
            <Text style={{ fontSize: 18, marginBottom: 8 }}>Select Bank</Text>
            <RadioButton.Group onValueChange={(value) => setSelectedBank(value)} value={selectedBank ?? ''}>
              {banks.map((b) => (
                <RadioButton.Item key={b.id} label={b.label} value={b.id} />
              ))}
            </RadioButton.Group>
            <Button onPress={pickFile}>Pick PDF</Button>
            {file && <Text style={{ marginVertical: 8 }}>{file.name}</Text>}
            <Button onPress={upload}>Upload</Button>
            <Button onPress={() => { setModalVisible(false); setSelectedBank(null); setFile(null); }}>Cancel</Button>
          </View>
        </Modal>

        <FAB icon="upload" onPress={openUploadModal} style={{ position: 'absolute', right: 16, bottom: 16 }} accessibilityLabel="Upload statement" />

      </View>
    );
  };

  const ManageRoute = () => (
    <View style={{ flex: 1, padding: 16, paddingTop: 48 }}>
      <Text style={{ fontSize: 18, marginBottom: 8 }}>Manage</Text>
      <Button mode="contained" onPress={() => router.push('/bank-accounts')} style={{ marginBottom: 8 }}>
        Manage bank accounts
      </Button>
      <Button mode="contained" onPress={() => router.push('/expense-categories')}>
        Manage expense categories
      </Button>
    </View>
  );

  const SettingsRoute = () => (
    <View style={{ flex: 1 }}>
      <Settings />
    </View>
  );

  const renderScene = BottomNavigation.SceneMap({
    statements: StatementsRoute,
    manage: ManageRoute,
    settings: SettingsRoute,
  });

  return (
    <BottomNavigation
      navigationState={{ index: navIndex, routes: navRoutes }}
      onIndexChange={setNavIndex}
      renderScene={renderScene}
    />
  );
}
