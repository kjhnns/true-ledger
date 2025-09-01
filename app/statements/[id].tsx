import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  List,
  Modal,
  Portal,
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
} from '../../lib/entities';
import { getStatement } from '../../lib/statements';
import {
  listTransactions,
  Transaction,
  updateTransaction,
} from '../../lib/transactions';

interface TxnRow extends Transaction {
  senderLabel: string;
  recipientLabel: string;
}

export default function StatementTransactions() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
    currency: string;
    count: number;
  } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [ascending, setAscending] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const theme = useTheme();

  useEffect(() => {
    (async () => {
      if (!id) return;
      const [stmt, list] = await Promise.all([
        getStatement(id),
        listTransactions(id),
      ]);
      const enriched: TxnRow[] = [];
      for (const t of list) {
        const recipient = t.recipientId
          ? await getEntity(t.recipientId)
          : null;
        const sender = t.senderId ? await getEntity(t.senderId) : null;
        enriched.push({
          ...t,
          recipientLabel: recipient?.label ?? '',
          senderLabel: sender?.label ?? '',
        });
      }
      setTransactions(enriched);
      if (stmt) {
        const bank = await getEntity(stmt.bankId);
        const dates = list.map((t) => t.createdAt);
        setMeta({
          uploadDate: stmt.uploadDate,
          earliest: Math.min(...dates),
          latest: Math.max(...dates),
          bank: bank?.label ?? '',
          bankId: stmt.bankId,
          currency: bank?.currency ?? '',
          count: list.length,
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

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString();

  const sorted = [...transactions].sort((a, b) => {
    const aVal =
      sortBy === 'date' ? a.createdAt : a.sharedAmount ?? a.amount;
    const bVal =
      sortBy === 'date' ? b.createdAt : b.sharedAmount ?? b.amount;
    return ascending ? aVal - bVal : bVal - aVal;
  });

  const toggleSort = (col: 'date' | 'amount') => {
    if (sortBy === col) {
      setAscending(!ascending);
    } else {
      setSortBy(col);
      setAscending(false);
    }
  };

  const handleToggleShared = (txn: TxnRow, value: boolean) => {
    if (value) {
      Alert.prompt(
        'Shared Amount',
        'Enter shared amount',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'OK',
            onPress: async (text) => {
              const amt = Number(text);
              if (isNaN(amt)) return;
              await updateTransaction(txn.id, {
                shared: true,
                sharedAmount: amt,
              });
              setTransactions((prev) =>
                prev.map((t) =>
                  t.id === txn.id
                    ? { ...t, shared: true, sharedAmount: amt }
                    : t
                )
              );
            },
          },
        ],
        'plain-text',
        txn.sharedAmount ? String(txn.sharedAmount) : ''
      );
    } else {
      (async () => {
        await updateTransaction(txn.id, { shared: false, sharedAmount: null });
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === txn.id ? { ...t, shared: false, sharedAmount: null } : t
          )
        );
      })();
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
  };

  const editSharedAmount = (txn: TxnRow) => {
    Alert.prompt(
      'Shared Amount',
      'Enter shared amount',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async (text) => {
            const amt = Number(text);
            if (isNaN(amt)) return;
            await updateTransaction(txn.id, { sharedAmount: amt });
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === txn.id ? { ...t, sharedAmount: amt } : t
              )
            );
          },
        },
      ],
      'plain-text',
      txn.sharedAmount ? String(txn.sharedAmount) : ''
    );
  };

  const openEntityPicker = (txnId: string, field: 'sender' | 'recipient') => {
    setPicker({ txnId, field });
  };

  const selectEntity = async (entityId: string) => {
    if (!picker) return;
    const field = picker.field === 'sender' ? { senderId: entityId } : { recipientId: entityId };
    await updateTransaction(picker.txnId, field);
    const label = entities.find((e) => e.id === entityId)?.label ?? '';
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
      {meta && (
        <View style={{ marginBottom: 16 }}>
          <Text>Uploaded: {formatDate(meta.uploadDate)}</Text>
          <Text>
            Date Range: {formatDate(meta.earliest)} - {formatDate(meta.latest)}
          </Text>
          <Text>
            Bank: {meta.bank} ({meta.currency})
          </Text>
          <Text>Transactions: {meta.count}</Text>
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
                                <Text style={{ fontWeight: '700' }}>{signed}</Text>
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
      <Portal>
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
                        await updateTransaction(editing.txn.id, { shared: newVal, sharedAmount: newVal ? (editing.txn.sharedAmount ?? null) : null });
                        setTransactions((prev) => prev.map((t) => t.id === editing.txn.id ? { ...t, shared: newVal, sharedAmount: newVal ? (editing.txn.sharedAmount ?? null) : null } : t));
                        setEditing({ txn: { ...editing.txn, shared: newVal, sharedAmount: newVal ? (editing.txn.sharedAmount ?? null) : null } });
                      }}
                    />
                    {editing.txn.shared && (
                      <TextInput
                        mode="outlined"
                        style={{ flex: 1, marginLeft: 12, height: 40 }}
                        keyboardType="numeric"
                        value={editing.txn.sharedAmount !== null && editing.txn.sharedAmount !== undefined ? String(editing.txn.sharedAmount) : ''}
                        onChangeText={(text) => {
                          const amt = text === '' ? null : Number(text);
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
      </Portal>
    </View>
  );
}
