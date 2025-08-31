import { useEffect, useState } from 'react';
import { Alert, ScrollView, View, useWindowDimensions } from 'react-native';
import {
  DataTable,
  Text,
  Switch,
  Portal,
  Modal,
  List,
  Checkbox,
  useTheme,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import {
  getEntity,
  listEntities,
  Entity,
  EntityCategory,
} from '../../lib/entities';
import {
  listTransactions,
  Transaction,
  updateTransaction,
} from '../../lib/transactions';
import { getStatement } from '../../lib/statements';

interface TxnRow extends Transaction {
  senderLabel: string;
  recipientLabel: string;
}

export default function StatementTransactions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [picker, setPicker] = useState<{ txnId: string; field: 'sender' | 'recipient' } | null>(null);
  const [meta, setMeta] = useState<{
    uploadDate: number;
    earliest: number;
    latest: number;
    bank: string;
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
          <DataTable>
            <DataTable.Header>
              <DataTable.Title
                sortDirection={
                  sortBy === 'date' ? (ascending ? 'ascending' : 'descending') : undefined
                }
                onPress={() => toggleSort('date')}
              >
                Date
              </DataTable.Title>
              <DataTable.Title>Sender</DataTable.Title>
              <DataTable.Title>Recipient</DataTable.Title>
              {isLandscape && <DataTable.Title>Description</DataTable.Title>}
              <DataTable.Title
                numeric
                sortDirection={
                  sortBy === 'amount'
                    ? ascending
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                onPress={() => toggleSort('amount')}
              >
                Amount
              </DataTable.Title>
              <DataTable.Title style={{ justifyContent: 'center', width: 64 }}>
                Shared
              </DataTable.Title>
              <DataTable.Title style={{ justifyContent: 'center', width: 64 }}>
                Reviewed
              </DataTable.Title>
            </DataTable.Header>
            {sorted.map((item) => (
              <DataTable.Row key={item.id}>
                <DataTable.Cell>{formatDate(item.createdAt)}</DataTable.Cell>
                <DataTable.Cell onPress={() => openEntityPicker(item.id, 'sender')}>
                  {item.senderLabel}
                </DataTable.Cell>
                <DataTable.Cell onPress={() => openEntityPicker(item.id, 'recipient')}>
                  {item.recipientLabel}
                </DataTable.Cell>
                {isLandscape && (
                  <DataTable.Cell>{item.description ?? '-'}</DataTable.Cell>
                )}
                <DataTable.Cell
                  numeric
                  onPress={() => item.shared && editSharedAmount(item)}
                >
                  {item.shared
                    ? `${item.sharedAmount} (${item.amount})`
                    : item.amount}
                </DataTable.Cell>
                <DataTable.Cell style={{ justifyContent: 'center', width: 64 }}>
                  <Switch
                    value={item.shared}
                    onValueChange={(v) => handleToggleShared(item, v)}
                  />
                </DataTable.Cell>
                <DataTable.Cell style={{ justifyContent: 'center', width: 64 }}>
                  <Checkbox
                    status={item.reviewedAt ? 'checked' : 'unchecked'}
                    onPress={() => toggleReviewed(item)}
                  />
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </ScrollView>
      )}
      <Portal>
        <Modal visible={!!picker} onDismiss={() => setPicker(null)}>
          <ScrollView style={{ maxHeight: 400, backgroundColor: theme.colors.background }}>
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
