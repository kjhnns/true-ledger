import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BottomNavigation, Button, Card, Chip, Dialog, IconButton, List, Menu, Portal, ProgressBar, RadioButton, Snackbar, Text } from 'react-native-paper';
import { loadBanksForModal } from '../lib/banks';
import { Entity, listBankAccounts } from '../lib/entities';
import { DEFAULT_SYSTEM_PROMPT, OPENAI_KEY_STORAGE_KEY, processStatementFile, SYSTEM_PROMPT_STORAGE_KEY } from '../lib/openai';
import { archiveStatement, createStatement, deleteStatement, listStatementsWithMeta, reprocessStatement, StatementMeta, unarchiveStatement } from '../lib/statements';
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

function ActionMenu({
  item,
  viewArchived,
  onRequestDelete,
  refresh,
}: {
  item: StatementMeta;
  viewArchived: 'current' | 'archived';
  onRequestDelete: (id: string) => void;
  refresh: () => Promise<void>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <IconButton
          icon="dots-vertical"
          size={20}
          onPress={() => setVisible(true)}
          accessibilityLabel={`Open actions for ${item.id}`}
        />
      }
    >
      <Menu.Item
        leadingIcon="autorenew"
        onPress={async () => {
          setVisible(false);
          await reprocessStatement(item.id);
          await refresh();
        }}
        title="Reprocess"
      />
      <Menu.Item
        leadingIcon={viewArchived === 'archived' ? 'archive-arrow-up' : 'archive'}
        onPress={async () => {
          setVisible(false);
          if (viewArchived === 'archived') await unarchiveStatement(item.id);
          else await archiveStatement(item.id);
          await refresh();
        }}
        title={viewArchived === 'archived' ? 'Unarchive' : 'Archive'}
      />
      <Menu.Item
        leadingIcon="delete"
        onPress={() => {
          setVisible(false);
          onRequestDelete(item.id);
        }}
        title="Delete"
      />
    </Menu>
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
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [progress, setProgress] = useState<Record<string, number>>({});
  const showToast = (message: string) => setToast({ visible: true, message });

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
    const stmt = await createStatement({
      bankId: selectedBank,
      uploadDate: Date.now(),
      file: file.name,
      status: 'new',
    });
    await refreshStatements();
    setModalVisible(false);
    setProgress((p) => ({ ...p, [stmt.id]: 0 }));
    showToast('Statement is being processed');
    const apiKey = await SecureStore.getItemAsync(OPENAI_KEY_STORAGE_KEY);
    const sysPrompt =
      (await SecureStore.getItemAsync(SYSTEM_PROMPT_STORAGE_KEY)) ??
      DEFAULT_SYSTEM_PROMPT;
    const fileObj: any = {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/pdf',
    };
    processStatementFile({
      statementId: stmt.id,
      bankId: selectedBank,
      file: fileObj,
      apiKey: apiKey || '',
      systemPrompt: sysPrompt,
      onProgress: (p) =>
        setProgress((prev) => ({ ...prev, [stmt.id]: p })),
    })
      .then(async () => {
        setProgress((prev) => {
          const { [stmt.id]: _, ...rest } = prev;
          return rest;
        });
        await refreshStatements();
      })
      .catch((e) => {
        showToast(e.message || 'Processing failed');
        setProgress((prev) => {
          const { [stmt.id]: _, ...rest } = prev;
          return rest;
        });
      });
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
  const [bankAccounts, setBankAccounts] = useState<import('../lib/entities').Entity[]>([]);
  const [filterBankId, setFilterBankId] = useState<string | null>(null);
    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    const formatRange = (start: number | null, end: number | null) => {
      if (!start || !end) return '-';
      const from = new Date(start).toLocaleDateString();
      const to = new Date(end).toLocaleDateString();
      return from === to ? from : `${from} - ${to}`;
    };

    const getStatusLabel = (s: StatementMeta) => {
      if (s.publishedAt) return 'Published';
      if (s.reviewedAt) return 'Reviewed';
      if (s.processedAt) return 'Processed';
      return 'New';
    };

    const sorted = statements.slice().sort((a, b) => b.uploadDate - a.uploadDate);
    const filtered = sorted
      .filter((s) => (viewArchived === 'archived' ? s.archivedAt !== null : s.archivedAt === null))
      .filter((s) => (filterBankId ? s.bankId === filterBankId : true));

    useEffect(() => {
      (async () => {
        const b = await listBankAccounts();
        setBankAccounts(b);
      })();
    }, []);

    return (
      <View style={{ flex: 1, padding: 16 }}>

        {/* Bank filter chips - top, intrinsic height */}
        <View style={{ marginBottom: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Chip
                mode={!filterBankId ? 'flat' : 'outlined'}
                selected={!filterBankId}
                onPress={() => setFilterBankId(null)}
                style={{ marginRight: 8 }}
              >
                All
              </Chip>
              {bankAccounts.map((b) => (
                <Chip
                  key={b.id}
                  mode={filterBankId === b.id ? 'flat' : 'outlined'}
                  selected={filterBankId === b.id}
                  onPress={() => setFilterBankId(filterBankId === b.id ? null : b.id)}
                  style={{ marginRight: 8 }}
                >
                  {b.label}
                </Chip>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Statements table - takes remaining space and scrolls internally */}
        <View style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <Text>No statements</Text>
          ) : (
            <ScrollView>
                  {filtered.map((item) => (
                    <Card key={item.id} style={{ marginBottom: 8 }} >
                      <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/statements/${item.id}`)}>
                            <Text style={{ fontWeight: '700' }}>{formatRange(item.earliest, item.latest)}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                              <Chip mode="outlined" style={{ marginRight: 8 }}>{item.bankLabel}</Chip>
                              <Chip mode="outlined" style={{ marginRight: 8 }}>{getStatusLabel(item)}</Chip>
                              <Text style={{ color: 'gray' }}>{new Date(item.uploadDate).toLocaleDateString()}</Text>
                            </View>
                          </TouchableOpacity>
                          <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                            <Text>{item.transactionCount} records</Text>
                            <View style={{ marginTop: 8 }}>
                              <ActionMenu item={item} viewArchived={viewArchived} onRequestDelete={(id) => { setDeleteTarget(id); setConfirmVisible(true); }} refresh={refreshStatements} />
                            </View>
                          </View>
                        </View>
                        {item.status === 'new' && progress[item.id] !== undefined && (
                          <ProgressBar progress={progress[item.id]} style={{ marginTop: 8 }} />
                        )}
                      </Card.Content>
                    </Card>
                  ))}
            </ScrollView>
          )}
        </View>

        {/* Dialog portal remains here */}
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
          <View style={{ flex: 1, padding: 16, paddingTop: 64 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Upload bank statement</Text>

            <List.Section>
              <List.Subheader>Bank</List.Subheader>
              <RadioButton.Group onValueChange={(value) => setSelectedBank(value)} value={selectedBank ?? ''}>
                {banks.map((b) => (
                  <RadioButton.Item key={b.id} label={b.label} value={b.id} />
                ))}
              </RadioButton.Group>
            </List.Section>

            <List.Section>
              <List.Subheader>File</List.Subheader>
              <Button mode="contained" icon="file-upload" onPress={pickFile} style={{ marginBottom: 8 }} accessibilityLabel="Pick PDF file">
                Pick PDF file
              </Button>
              <Text style={{ fontSize: 12, color: 'gray', marginBottom: 8 }}>Only PDF files are allowed</Text>
              {file && <Text style={{ marginVertical: 8 }}>{file.name}</Text>}
            </List.Section>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={upload} style={{ marginRight: 8 }}>Upload</Button>
              <Button onPress={() => { setModalVisible(false); setSelectedBank(null); setFile(null); }}>Cancel</Button>
            </View>
          </View>
        </Modal>

        {/* bottom controls: archived toggle and upload button - part of normal layout */}
        <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            mode={viewArchived === 'archived' ? 'contained' : 'outlined'}
            icon={viewArchived === 'archived' ? 'archive-arrow-up' : 'archive'}
            onPress={() => setViewArchived(viewArchived === 'archived' ? 'current' : 'archived')}
            accessibilityLabel={viewArchived === 'archived' ? 'Show current statements' : 'Show archived statements'}
            style={{ flex: 1, marginRight: 12 }}
          >
            {viewArchived === 'archived' ? 'Archived' : 'Current'}
          </Button>

          <Button mode="contained" icon="upload" onPress={openUploadModal}>
            Upload
          </Button>
        </View>

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
    <>
      <BottomNavigation
        navigationState={{ index: navIndex, routes: navRoutes }}
        onIndexChange={setNavIndex}
        renderScene={renderScene}
      />
      <Snackbar
        visible={toast.visible}
        onDismiss={() => setToast({ visible: false, message: '' })}
        duration={3000}
      >
        {toast.message}
      </Snackbar>
    </>
  );
}
