import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getEntity } from '../../lib/entities';
import { listTransactions, Transaction } from '../../lib/transactions';

interface TxnRow extends Transaction {
  senderLabel: string;
  recipientLabel: string;
}

export default function StatementTransactions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transactions, setTransactions] = useState<TxnRow[]>([]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const list = await listTransactions(id);
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
    })();
  }, [id]);

  const Header = () => (
    <View
      style={{
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
      }}
    >
      <Text style={{ flex: 1, fontWeight: 'bold' }}>Recipient</Text>
      <Text style={{ flex: 1, fontWeight: 'bold' }}>Sender</Text>
      <Text style={{ width: 80, textAlign: 'right', fontWeight: 'bold' }}>
        Amount
      </Text>
      <Text style={{ width: 60, textAlign: 'center', fontWeight: 'bold' }}>
        Shared
      </Text>
      <Text style={{ width: 80, textAlign: 'right', fontWeight: 'bold' }}>
        Shared Amt
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={<Header />}
        ListEmptyComponent={<Text>No transactions</Text>}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 8,
              borderBottomWidth: 1,
            }}
          >
            <Text style={{ flex: 1 }}>{item.recipientLabel}</Text>
            <Text style={{ flex: 1 }}>{item.senderLabel}</Text>
            <Text style={{ width: 80, textAlign: 'right' }}>{item.amount}</Text>
            <Text style={{ width: 60, textAlign: 'center' }}>
              {item.shared ? 'Yes' : 'No'}
            </Text>
            <Text style={{ width: 80, textAlign: 'right' }}>
              {item.sharedAmount ?? '-'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
