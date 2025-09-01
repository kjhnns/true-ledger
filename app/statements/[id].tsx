import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Alert, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  FAB,
  List,
  Modal,
  Portal,
  ProgressBar,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import {
  Entity,
  EntityCategory,
  getEntity,
  listEntities,
  updateBankAccount,
} from '../../lib/entities';
import { getStatement, reprocessStatement } from '../../lib/statements';
import {
  listTransactions,
  Transaction,
  updateTransaction,
  getReviewedAmountProgress,
  markAllTransactionsReviewed,
} from '../../lib/transactions';
import { getDefaultSharedPercent } from '../../lib/settings';
import LearnModal, { LearnTxn } from '../LearnModal';
import * as SecureStore from 'expo-secure-store';
import {
  OPENAI_KEY_STORAGE_KEY,
  SYSTEM_PROMPT_STORAGE_KEY,
  DEFAULT_SYSTEM_PROMPT,
  processStatementFile,
} from '../../lib/openai';

interface TxnRow extends Transaction {
  senderLabel: string;
  recipientLabel: string;
}

export default function StatementTransactions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [picker, setPicker] = useState<{ txnId: string; field: 'sender' | 'recipient' } | null>(null);
  const [editing, setEditing] = useState<{ txn: TxnRow } | null>(null);
  const [meta, setMeta] = useState<{
    uploadDate: number;
    earliest: number;
    latest: number;
    bank: string;
    bankId: string;
    bankPrompt: string;
    currency: string;
    count: number;
    externalFileId: string | null;
  } | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [promptModal, setPromptModal] = useState(false);
  const [promptEdit, setPromptEdit] = useState('');
  const [defaultPercent, setDefaultPercent] = useState(50);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [ascending, setAscending] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [learnVisible, setLearnVisible] = useState(false);
  const [processingVisible, setProcessingVisible] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLog, setProcessingLog] = useState('');
  const [processingDone, setProcessingDone] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const theme = useTheme();

  const getLabelWithParent = async (id: string | null) => {
    if (!id) return '';
    const ent = await getEntity(id);
    if (!ent) return '';
    if (ent.parentId) {
      const parent = await getEntity(ent.parentId);
      return parent ? `${parent.label} - ${ent.label}` : ent.label;
    }
    return ent.label;
  };

  const formatLabelLocal = (entityId: string) => {
    const ent = entities.find((e) => e.id === entityId);
    if (!ent) return '';
    if (ent.parentId) {
      const parent = entities.find((e) => e.id === ent.parentId);
      return parent ? `${parent.label} - ${ent.label}` : ent.label;
    }
    return ent.label;
  };

  const handleMarkAllReviewed = async () => {
    if (!id) return;
    await markAllTransactionsReviewed(id);
    const now = Date.now();
    setTransactions((prev) => prev.map((t) => ({ ...t, reviewedAt: now })));
    setReviewedCount(meta ? meta.count : transactions.length);
  };

  const openBankPrompt = () => {
    if (!meta) return;
    setPromptEdit(meta.bankPrompt);
    setPromptModal(true);
  };

  const handleReprocess = () => {
    if (!id || !meta) return;
    Alert.alert('Reprocess statement', 'Existing transactions will be dropped. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'OK',
        onPress: async () => {
          await reprocessStatement(id);
          const apiKey = await SecureStore.getItemAsync(OPENAI_KEY_STORAGE_KEY);
          const sysPrompt =
            (await SecureStore.getItemAsync(SYSTEM_PROMPT_STORAGE_KEY)) ??
            DEFAULT_SYSTEM_PROMPT;
          if (!apiKey) {
            Alert.alert('Missing API key');
            return;
          }
          setProcessingVisible(true);
          setProcessingProgress(0);
          setProcessingLog('');
          setProcessingDone(false);
          try {
            await processStatementFile({
              statementId: id,
              bankId: meta.bankId,
              fileId: meta.externalFileId || undefined,
              apiKey: apiKey || '',
              systemPrompt: sysPrompt,
              onProgress: (p) => setProcessingProgress(p),
            });
            setProcessingLog((l) => l + 'done\n');
            setProcessingDone(true);
            const [stmt, list] = await Promise.all([
              getStatement(id),
              listTransactions(id),
            ]);
            const enriched: TxnRow[] = [];
            for (const t of list) {
              const recipientLabel = await getLabelWithParent(t.recipientId);
              const senderLabel = await getLabelWithParent(t.senderId);
              enriched.push({ ...t, recipientLabel, senderLabel });
            }
            setTransactions(enriched);
            setReviewedCount(list.filter((t) => t.reviewedAt).length);
            if (stmt) {
              const dates = list.map((t) => t.createdAt);
              setMeta({
                uploadDate: stmt.uploadDate,
                earliest: Math.min(...dates),
                latest: Math.max(...dates),
                bank: meta.bank,
                bankId: meta.bankId,
                bankPrompt: meta.bankPrompt,
                currency: meta.currency,
                count: list.length,
                externalFileId: stmt.externalFileId ?? null,
              });
            }
          } catch (e: any) {
            setProcessingLog((l) => l + `error: ${e.message || e}\n`);
            setProcessingDone(true);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [stmt, list, percent] = await Promise.all([
        getStatement(id),
        listTransactions(id),
        getDefaultSharedPercent(),
      ]);
      const enriched: TxnRow[] = [];
      for (const t of list) {
        const recipientLabel = await getLabelWithParent(t.recipientId);
        const senderLabel = await getLabelWithParent(t.senderId);
        enriched.push({
          ...t,
          recipientLabel,
          senderLabel,
        });
      }
      setTransactions(enriched);
      setReviewedCount(list.filter((t) => t.reviewedAt).length);
      setDefaultPercent(percent);
      if (stmt) {
        const bank = await getEntity(stmt.bankId);
        const dates = list.map((t) => t.createdAt);
        setMeta({
          uploadDate: stmt.uploadDate,
          earliest: Math.min(...dates),
          latest: Math.max(...dates),
          bank: bank?.label ?? '',
          bankId: stmt.bankId,
          bankPrompt: bank?.prompt ?? '',
          currency: bank?.currency ?? '',
          count: list.length,
          externalFileId: stmt.externalFileId ?? null,
        });
      }
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      const cats: EntityCategory[] = ['bank', 'expense', 'income', 'savings'];
      const lists = await Promise.all(cats.map((c) => listEntities(c)));
      setEntities(lists.flat());
    })();
  }, []);

  useEffect(() => {
    if (meta?.bank) {
      navigation.setOptions({ title: meta.bank });
    }
  }, [navigation, meta?.bank]);

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  const sorted = [...transactions].sort((a, b) => {
    const aVal =
      sortBy === 'date' ? a.createdAt : a.sharedAmount ?? a.amount;
    const bVal =
      sortBy === 'date' ? b.createdAt : b.sharedAmount ?? b.amount;
    return ascending ? aVal - bVal : bVal - aVal;
  });

  const progress = useMemo(
    () => getReviewedAmountProgress(transactions),
    [transactions]
  );

  const countPct = meta && meta.count ? (reviewedCount / meta.count) * 100 : 0;
  const amountPct = progress.total
    ? (progress.reviewed / progress.total) * 100
    : 0;
  const nf = meta
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: meta.currency || 'USD',
      })
    : null;

  const toggleSort = (col: 'date' | 'amount') => {
    if (sortBy === col) {
      setAscending(!ascending);
    } else {
      setSortBy(col);
      setAscending(false);
    }
  };

  const handleToggleShared = async (txn: TxnRow, value: boolean) => {
    if (value) {
      const amt = Math.round(txn.amount * defaultPercent / 100);
      await updateTransaction(txn.id, { shared: true, sharedAmount: amt });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txn.id ? { ...t, shared: true, sharedAmount: amt } : t
        )
      );
    } else {
      await updateTransaction(txn.id, { shared: false, sharedAmount: null });
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txn.id ? { ...t, shared: false, sharedAmount: null } : t
        )
      );
    }
  };

  const toggleReviewed = async (txn: TxnRow) => {
    const reviewedAt = txn.reviewedAt ? null : Date.now();
    const updated = await updateTransaction(txn.id, { reviewedAt });
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txn.id ? { ...t, reviewedAt: updated.reviewedAt } : t
      )
    );
    setReviewedCount((c) => c + (reviewedAt ? 1 : -1));
  };

  const openEntityPicker = (txnId: string, field: 'sender' | 'recipient') => {
    setPicker({ txnId, field });
  };

  const selectEntity = async (entityId: string) => {
    if (!picker) return;
    const field = picker.field === 'sender' ? { senderId: entityId } : { recipientId: entityId };
    await updateTransaction(picker.txnId, field);
    const label = formatLabelLocal(entityId);
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === picker.txnId
          ? {
              ...t,
              ...(picker.field === 'sender'
                ? { senderId: entityId, senderLabel: label }
                : { recipientId: entityId, recipientLabel: label }),
            }
          : t
      )
    );
  // keep the edit modal in sync if it's open for the same txn
  setEditing((cur) => cur && cur.txn.id === picker.txnId ? { txn: { ...cur.txn, ...(picker.field === 'sender' ? { senderId: entityId, senderLabel: label } : { recipientId: entityId, recipientLabel: label }) } } : cur);
    setPicker(null);
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {meta && nf && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text>Uploaded: {formatDate(meta.uploadDate)}</Text>
              <Text>
                Date Range: {formatDate(meta.earliest)} - {formatDate(meta.latest)}
              </Text>
              <Text>Transactions: {meta.count}</Text>
              <Text>Total Amount: {nf.format(progress.total)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text>
                Reviewed: {reviewedCount} / {meta.count} ({countPct.toFixed(1)}%)
              </Text>
              <Text>
                Reviewed Amount: {nf.format(progress.reviewed)} / {nf.format(
                  progress.total
                )} ({amountPct.toFixed(1)}%)
              </Text>
            </View>
          </View>
        </View>
      )}
      {transactions.length === 0 ? (
        <Text>No transactions</Text>
      ) : (
        <ScrollView>
          <View style={{ marginBottom: 12 }}>
            <SegmentedButtons
              value={sortBy}
              onValueChange={(v) => toggleSort(v as 'date' | 'amount')}
              buttons={[
                { value: 'date', label: 'Date' },
                { value: 'amount', label: 'Amount' },
              ]}
            />
          </View>
          <ScrollView>
            {sorted.map((item) => {
                  if (!meta) return null;
                  const bankId = meta.bankId;
                  const isBankSender = item.senderId === bankId;
                  const isBankRecipient = item.recipientId === bankId;
                  const otherIsRecipient = isBankSender; // when bank is sender, other party is recipient
                  const subjectLabel = otherIsRecipient ? item.recipientLabel : item.senderLabel;
                  const displayAmountVal = item.shared ? (item.sharedAmount ?? item.amount) : item.amount;
                  const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: meta.currency || 'USD' });
                  const signed = isBankSender ? `- ${nf.format(displayAmountVal)}` : isBankRecipient ? `+ ${nf.format(displayAmountVal)}` : nf.format(displayAmountVal);
                  return (
                    <View key={item.id} style={{ marginBottom: 12 }}>
                      <Card>
                        <Card.Content>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ marginRight: 8 }}>
                              <Checkbox
                                status={item.reviewedAt ? 'checked' : 'unchecked'}
                                onPress={() => toggleReviewed(item)}
                              />
                            </View>
                            <TouchableOpacity onPress={() => setEditing({ txn: item })} style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700' }}>{subjectLabel || (otherIsRecipient ? item.recipientLabel : item.senderLabel) || '—'}</Text>
                              <Text style={{ color: 'gray', marginTop: 4 }}>{item.description ?? '-'}</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'flex-end', marginLeft: 12 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {item.shared && <Text style={{ marginRight: 6, color: 'gray' }}>(shared)</Text>}
                                <Text style={{ fontWeight: '700', color: isBankSender ? 'red' : isBankRecipient ? 'green' : undefined }}>{signed}</Text>
                              </View>
                              <Text style={{ color: 'gray', marginTop: 6 }}>{formatDate(item.createdAt)}</Text>
                            </View>
                          </View>
                        </Card.Content>
                      </Card>
                    </View>
                  );
                })}
              </ScrollView>
        </ScrollView>
      )}
      {meta && (
        <LearnModal
          visible={learnVisible}
          bank={{ id: meta.bankId, prompt: meta.bankPrompt, label: meta.bank, currency: meta.currency }}
          transactions={transactions as unknown as LearnTxn[]}
          onDismiss={() => setLearnVisible(false)}
          onComplete={(p) => setMeta((m) => (m ? { ...m, bankPrompt: p } : m))}
        />
      )}
      <Portal>
        <Modal visible={promptModal} onDismiss={() => setPromptModal(false)} contentContainerStyle={{ backgroundColor: theme.colors.background, padding: 12, margin: 20, borderRadius: 12 }}>
          <Text style={{ marginBottom: 8 }}>Edit bank prompt</Text>
          <TextInput
            mode="outlined"
            multiline
            value={promptEdit}
            onChangeText={setPromptEdit}
            style={{ marginBottom: 8 }}
          />
          <Button onPress={async () => {
            if (!meta) return;
            await updateBankAccount(meta.bankId, { label: meta.bank, prompt: promptEdit, currency: meta.currency });
            setMeta((m) => m ? { ...m, bankPrompt: promptEdit } : m);
            setPromptModal(false);
          }}>Save</Button>
        </Modal>
        <Modal
          visible={processingVisible}
          dismissable={false}
          contentContainerStyle={{ backgroundColor: theme.colors.background, padding: 12, margin: 20, borderRadius: 12 }}
        >
          <Text style={{ marginBottom: 8 }}>Reprocessing</Text>
          <ProgressBar progress={processingProgress} style={{ marginBottom: 8 }} />
          <ScrollView style={{ maxHeight: 200, marginBottom: 8 }}>
            <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>{processingLog}</Text>
          </ScrollView>
          <Button onPress={() => setProcessingVisible(false)} disabled={!processingDone}>Close</Button>
        </Modal>
        <Modal
          visible={!!editing}
          onDismiss={() => setEditing(null)}
          contentContainerStyle={{
            backgroundColor: theme.colors.background,
            padding: 12,
            margin: 20,
            borderRadius: 12,
            maxHeight: height * 0.8,
          }}
        >
          {editing && (
            <View style={{ padding: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>Edit transaction</Text>
                <Button onPress={() => setEditing(null)}>Dismiss</Button>
              </View>
              <ScrollView>
                <View style={{ marginTop: 12 }}>
                  <Text>Description</Text>
                  <Text style={{ marginTop: 6 }}>{editing.txn.description ?? '-'}</Text>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text>Amount</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ fontWeight: '700', marginRight: 12 }}>{new Intl.NumberFormat(undefined, { style: 'currency', currency: meta?.currency ?? 'USD' }).format(editing.txn.amount)}</Text>
                    <Text style={{ marginRight: 8 }}>Shared</Text>
                    <Switch
                      value={!!editing.txn.shared}
                      onValueChange={async (newVal) => {
                        const amt = newVal ? Math.round(editing.txn.amount * defaultPercent / 100) : null;
                        await updateTransaction(editing.txn.id, { shared: newVal, sharedAmount: amt });
                        setTransactions((prev) => prev.map((t) => t.id === editing.txn.id ? { ...t, shared: newVal, sharedAmount: amt } : t));
                        setEditing({ txn: { ...editing.txn, shared: newVal, sharedAmount: amt } });
                      }}
                    />
                    {editing.txn.shared && (
                      <TextInput
                        mode="outlined"
                        style={{ flex: 1, marginLeft: 12, height: 40 }}
                        keyboardType="numeric"
                        value={editing.txn.sharedAmount !== null && editing.txn.sharedAmount !== undefined ? String(Math.round((editing.txn.sharedAmount / editing.txn.amount) * 100)) : ''}
                        onChangeText={(text) => {
                          const pct = text === '' ? 0 : Number(text);
                          const amt = Math.round(editing.txn.amount * pct / 100);
                          setEditing((prev) => prev ? { txn: { ...prev.txn, sharedAmount: amt } } : null);
                        }}
                        onBlur={async () => {
                          if (!editing) return;
                          const amt = editing.txn.sharedAmount;
                          await updateTransaction(editing.txn.id, { sharedAmount: amt });
                          setTransactions((prev) => prev.map((t) => t.id === editing.txn.id ? { ...t, sharedAmount: amt } : t));
                        }}
                      />
                    )}
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text>Date</Text>
                  <TouchableOpacity onPress={() => {
                    const iso = new Date(editing.txn.createdAt).toISOString().slice(0,10);
                    Alert.prompt(
                      'Date (YYYY-MM-DD)',
                      undefined,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'OK',
                          onPress: (v) => {
                            if (!v) return;
                            const ts = new Date(v).getTime();
                            if (isNaN(ts)) return;
                            (async () => {
                              await updateTransaction(editing.txn.id, { createdAt: ts });
                              setTransactions((prev) => prev.map((t) => t.id === editing.txn.id ? { ...t, createdAt: ts } : t));
                              setEditing({ txn: { ...editing.txn, createdAt: ts } });
                            })();
                          },
                        },
                      ],
                      'plain-text',
                      iso
                    );
                  }}>
                    <Text style={{ color: 'blue', marginTop: 6 }}>{formatDate(editing.txn.createdAt)}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text>Sender</Text>
                  <TouchableOpacity onPress={() => openEntityPicker(editing.txn.id, 'sender')}>
                    <Text style={{ color: 'blue', marginTop: 6 }}>{editing.txn.senderLabel || 'Set sender'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text>Recipient</Text>
                  <TouchableOpacity onPress={() => openEntityPicker(editing.txn.id, 'recipient')}>
                    <Text style={{ color: 'blue', marginTop: 6 }}>{editing.txn.recipientLabel || 'Set recipient'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
        </Modal>

        <Modal
          visible={!!picker}
          onDismiss={() => setPicker(null)}
          contentContainerStyle={{
            backgroundColor: theme.colors.background,
            padding: 12,
            margin: 20,
            borderRadius: 12,
            maxHeight: height * 0.8,
          }}
        >
          <ScrollView style={{ backgroundColor: 'transparent' }}>
            {(['bank', 'expense', 'income', 'savings'] as EntityCategory[]).map(
              (cat) => (
                <List.Section key={cat} title={cat.toUpperCase()}>
                  {entities
                    .filter((e) => e.category === cat && !e.parentId)
                    .map((parent) => (
                      <View key={parent.id}>
                        <List.Item
                          title={parent.label}
                          onPress={() => selectEntity(parent.id)}
                        />
                        {entities
                          .filter((c) => c.parentId === parent.id)
                          .map((child) => (
                            <List.Item
                              key={child.id}
                              title={`  ${child.label}`}
                              onPress={() => selectEntity(child.id)}
                            />
                          ))}
                      </View>
                    ))}
                </List.Section>
              )
            )}
          </ScrollView>
        </Modal>
        <FAB.Group
          open={fabOpen}
          onStateChange={({ open }) => setFabOpen(open)}
          icon={fabOpen ? 'close' : 'menu'}
          actions={[
            {
              icon: 'pencil',
              label: 'Edit bank prompt',
              onPress: () => {
                setFabOpen(false);
                openBankPrompt();
              },
            },
            {
              icon: 'refresh',
              label: 'Reprocess',
              onPress: () => {
                setFabOpen(false);
                handleReprocess();
              },
            },
            {
              icon: 'check-all',
              label: 'Mark reviewed',
              onPress: () => {
                setFabOpen(false);
                handleMarkAllReviewed();
              },
            },
            {
              icon: 'book',
              label: 'Learn mode',
              onPress: () => {
                setFabOpen(false);
                setLearnVisible(true);
              },
            },
          ]}
        />
      </Portal>
    </View>
  );
}
