import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState, useCallback } from 'react';
import { ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { BottomNavigation, Button, Card, Chip, Dialog, IconButton, Menu, Portal, Snackbar, Text } from 'react-native-paper';
import { loadBanksForModal } from '../lib/banks';
import { Entity, listBankAccounts } from '../lib/entities';
import { DEFAULT_SYSTEM_PROMPT, OPENAI_KEY_STORAGE_KEY, processStatementFile, SYSTEM_PROMPT_STORAGE_KEY } from '../lib/openai';
import { archiveStatement, createStatement, deleteStatement, listStatementsWithMeta, reprocessStatement, StatementMeta, unarchiveStatement } from '../lib/statements';
import { fileFromShareUrl } from '../lib/share';
import Settings from './settings';
import UploadModal from './UploadModal';
import Analysis from './analysis';
import { useFocusEffect } from '@react-navigation/native';

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
  onReprocess,
}: {
  item: StatementMeta;
  viewArchived: 'current' | 'archived';
  onRequestDelete: (id: string) => void;
  refresh: () => Promise<void>;
  onReprocess: (item: StatementMeta) => void;
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
        onPress={() => {
          setVisible(false);
          onReprocess(item);
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
    {
      key: 'import',
      title: 'Import',
      focusedIcon: 'file-import',
      unfocusedIcon: 'file-import-outline',
    },
    {
      key: 'analysis',
      title: 'Analysis',
      focusedIcon: 'chart-bar',
      unfocusedIcon: 'chart-bar',
    },
    {
      key: 'settings',
      title: 'Settings',
      focusedIcon: 'cog',
      unfocusedIcon: 'cog-outline',
    },
  ]);
  const [statements, setStatements] = useState<StatementMeta[]>([]);
  const [banks, setBanks] = useState<Entity[]>([]);
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [modalScreen, setModalScreen] = useState<'form' | 'processing'>('form');
  const [processingStmtId, setProcessingStmtId] = useState<string | null>(null);
  const [processingLog, setProcessingLog] = useState<string>('');
  const [processingCompleted, setProcessingCompleted] = useState(false);
  const [processingAbortRequested, setProcessingAbortRequested] = useState(false);
  const [processingAbortController, setProcessingAbortController] = useState<AbortController | null>(null);
  const [toast, setToast] = useState({ visible: false, message: '' });
  const [progress, setProgress] = useState<Record<string, number>>({});
  const showToast = (message: string) => setToast({ visible: true, message });

  const refreshStatements = useCallback(async () => {
    const list = await listStatementsWithMeta();
    setStatements(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshStatements();
    }, [refreshStatements])
  );

  useEffect(() => {
    refreshStatements();
  }, [refreshStatements]);

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
    // ensure modal is visible and switch to processing screen
  setModalVisible(true);
  setModalScreen('processing');
  setProcessingStmtId(stmt.id);
    setProcessingLog('Queued for processing...\n');
  setProcessingCompleted(false);
  setProcessingAbortRequested(false);
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
    const controller = new AbortController();
    setProcessingAbortController(controller);

    processStatementFile({
      statementId: stmt.id,
      bankId: selectedBank,
      file: fileObj,
      apiKey: apiKey || '',
      systemPrompt: sysPrompt,
      signal: controller.signal,
      onProgress: (p) => {
        setProgress((prev) => ({ ...prev, [stmt.id]: p }));
        setProcessingLog((l) => l + `Progress: ${(p * 100).toFixed(0)}%\n`);
      },
    })
      .then(async () => {
        // mark completed
        setProcessingLog((l) => l + 'Processing completed\n');
        setProcessingCompleted(true);
        setProgress((prev) => {
          const { [stmt.id]: _, ...rest } = prev;
          return rest;
        });
        await refreshStatements();
      })
      .catch((e) => {
        setProcessingLog((l) => l + `Error: ${e?.message ?? String(e)}\n`);
        setProcessingCompleted(true);
        setProgress((prev) => {
          const { [stmt.id]: _, ...rest } = prev;
          return rest;
        });
        showToast(e.message || 'Processing failed');
        refreshStatements();
      });
    // keep modal open on processing screen until user closes
  };

  const openUploadModal = async () => {
  setModalScreen('form');
  setProcessingLog('');
  setProcessingStmtId(null);
  setProcessingCompleted(false);
  setProcessingAbortRequested(false);
  await loadBanksForModal(setBanks, setModalVisible);
  };

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      if (!(url.startsWith('content://') || url.startsWith('file://'))) return;
      await openUploadModal();
      setSelectedBank(null);
      setFile(fileFromShareUrl(url));
    };

    (async () => {
      const initial = await Linking.getInitialURL();
      await handleUrl(initial);
    })();

    const sub = Linking.addEventListener('url', (e) => {
      handleUrl(e.url);
    });
    return () => sub.remove();
  }, []);

  const ImportRoute = () => {
  const [viewArchived, setViewArchived] = useState<'current' | 'archived'>('current');
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [reprocessConfirm, setReprocessConfirm] = useState(false);
    const [reprocessTarget, setReprocessTarget] = useState<StatementMeta | null>(null);
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
                mode="outlined"
                onPress={() => setFilterBankId(null)}
                style={{
                  marginRight: 8,
                  backgroundColor: !filterBankId ? '#F5F5F5' : undefined,
                }}
              >
                All
              </Chip>
              {bankAccounts.map((b) => (
                <Chip
                  key={b.id}
                  mode="outlined"
                  onPress={() => setFilterBankId(filterBankId === b.id ? null : b.id)}
                  style={{
                    marginRight: 8,
                    backgroundColor: filterBankId === b.id ? '#F5F5F5' : undefined,
                  }}
                >
                  {b.label}
                </Chip>
              ))}
              <IconButton
                icon="plus"
                size={20}
                onPress={() => router.push('/bank-accounts/new')}
                accessibilityLabel="Add bank account"
              />
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
                    <Card
                      key={item.id}
                      mode="outlined"
                      style={{ marginBottom: 8, elevation: 0 }}
                    >
                      <Card.Content>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <TouchableOpacity
                            style={{ flex: 1 }}
                            onPress={() => router.push(`/statements/${item.id}`)}
                          >
                            <Text style={{ fontWeight: '700' }}>
                              {formatRange(item.earliest, item.latest)}
                            </Text>
                            <Text>
                              {item.bankLabel} • {item.reviewedCount}/{item.transactionCount}
                              {` reviewed`}
                            </Text>
                            <Text>Status: {getStatusLabel(item)}</Text>
                          </TouchableOpacity>
                          <View style={{ marginLeft: 12, justifyContent: 'center' }}>
                            <ActionMenu
                              item={item}
                              viewArchived={viewArchived}
                              onRequestDelete={(id) => {
                                setDeleteTarget(id);
                                setConfirmVisible(true);
                              }}
                              refresh={refreshStatements}
                              onReprocess={(stmt) => {
                                setReprocessTarget(stmt);
                                setReprocessConfirm(true);
                              }}
                            />
                          </View>
                        </View>
                        {/* per-item progress removed - overall processing is shown in the upload modal */}
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
              <Button mode="outlined" onPress={() => setConfirmVisible(false)}>
                Cancel
              </Button>
              <Button
                mode="outlined"
                onPress={async () => {
                if (deleteTarget) {
                  await deleteStatement(deleteTarget);
                  setDeleteTarget(null);
                  setConfirmVisible(false);
                  await refreshStatements();
                }
              }}
              >
                Delete
              </Button>
            </Dialog.Actions>
          </Dialog>
          <Dialog visible={reprocessConfirm} onDismiss={() => setReprocessConfirm(false)}>
            <Dialog.Title>Reprocess statement</Dialog.Title>
            <Dialog.Content>
              <Text>Existing transactions will be dropped. Continue?</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button mode="outlined" onPress={() => setReprocessConfirm(false)}>
                Cancel
              </Button>
              <Button
                mode="outlined"
                onPress={async () => {
                if (reprocessTarget) {
                  await reprocessStatement(reprocessTarget.id);
                  await refreshStatements();
                  setReprocessConfirm(false);
                  setModalScreen('processing');
                  setProcessingLog('Queued for processing...\n');
                  setProcessingStmtId(reprocessTarget.id);
                  setProcessingCompleted(false);
                  setProcessingAbortRequested(false);
                  setModalVisible(true);
                  setProgress((p) => ({ ...p, [reprocessTarget.id]: 0 }));
                  const apiKey = await SecureStore.getItemAsync(OPENAI_KEY_STORAGE_KEY);
                  const sysPrompt = (await SecureStore.getItemAsync(SYSTEM_PROMPT_STORAGE_KEY)) ?? DEFAULT_SYSTEM_PROMPT;
                  const controller = new AbortController();
                  setProcessingAbortController(controller);
                  processStatementFile({
                    statementId: reprocessTarget.id,
                    bankId: reprocessTarget.bankId,
                    fileId: reprocessTarget.externalFileId || undefined,
                    apiKey: apiKey || '',
                    systemPrompt: sysPrompt,
                    signal: controller.signal,
                    onProgress: (p) => {
                      setProgress((prev) => ({ ...prev, [reprocessTarget.id]: p }));
                      setProcessingLog((l) => l + `Progress: ${(p * 100).toFixed(0)}%\n`);
                    },
                  })
                    .then(async () => {
                      setProcessingLog((l) => l + 'Processing completed\n');
                      setProcessingCompleted(true);
                      setProgress((prev) => {
                        const { [reprocessTarget.id]: _, ...rest } = prev;
                        return rest;
                      });
                      await refreshStatements();
                    })
                    .catch((e) => {
                      setProcessingLog((l) => l + `Error: ${e?.message ?? String(e)}\n`);
                      setProcessingCompleted(true);
                      setProgress((prev) => {
                        const { [reprocessTarget.id]: _, ...rest } = prev;
                        return rest;
                      });
                      showToast(e.message || 'Processing failed');
                      refreshStatements();
                    });
                }
              }}
              >
                Reprocess
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <UploadModal
          visible={modalVisible}
          modalScreen={modalScreen}
          banks={banks}
          selectedBank={selectedBank}
          file={file}
          processingStmtId={processingStmtId}
          processingLog={processingLog}
          processingCompleted={processingCompleted}
          onPickFile={pickFile}
          onUpload={upload}
          onCancelForm={() => { setModalVisible(false); setSelectedBank(null); setFile(null); setModalScreen('form'); }}
          onAbort={() => {
            setProcessingAbortRequested(true);
            setProcessingLog((l) => l + 'Abort requested by user. Attempting to cancel...\n');
            if (processingAbortController) {
              processingAbortController.abort();
              setProcessingAbortController(null);
            }
          }}
          onClose={() => {
            if (processingCompleted) {
              setModalVisible(false);
              setModalScreen('form');
              setProcessingStmtId(null);
              setProcessingLog('');
              setProcessingCompleted(false);
            } else {
              setProcessingLog((l) => l + 'Processing still running — wait or abort.\n');
            }
          }}
          progress={progress}
          setSelectedBank={(v) => setSelectedBank(v)}
        />

        {/* bottom controls: archived toggle and upload button - part of normal layout */}
        <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            mode="outlined"
            icon={viewArchived === 'archived' ? 'archive-arrow-up' : 'archive'}
            onPress={() => setViewArchived(viewArchived === 'archived' ? 'current' : 'archived')}
            accessibilityLabel={viewArchived === 'archived' ? 'Show current statements' : 'Show archived statements'}
            style={{
              flex: 1,
              marginRight: 12,
              backgroundColor: viewArchived === 'archived' ? '#F5F5F5' : 'transparent',
            }}
          >
            {viewArchived === 'archived' ? 'Archived' : 'Current'}
          </Button>

          <Button mode="outlined" icon="upload" onPress={openUploadModal}>
            Upload
          </Button>
        </View>

      </View>
    );
  };

  const SettingsRoute = () => (
    <View style={{ flex: 1 }}>
      <Settings />
    </View>
  );

  const AnalysisRoute = () => (
    <View style={{ flex: 1 }}>
      <Analysis />
    </View>
  );

  const renderScene = BottomNavigation.SceneMap({
    import: ImportRoute,
    analysis: AnalysisRoute,
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
