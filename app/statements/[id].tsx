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
    <View className="flex-row py-2 border-b">
      <Text className="flex-1 font-bold">Recipient</Text>
      <Text className="flex-1 font-bold">Sender</Text>
      <Text className="w-20 text-right font-bold">Amount</Text>
      <Text className="w-16 text-center font-bold">Shared</Text>
      <Text className="w-20 text-right font-bold">Shared Amt</Text>
    </View>
  );

  return (
    <View className="flex-1 p-4">
      <FlatList
        data={transactions}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={<Header />}
        ListEmptyComponent={<Text>No transactions</Text>}
        renderItem={({ item }) => (
          <View className="flex-row py-2 border-b">
            <Text className="flex-1">{item.recipientLabel}</Text>
            <Text className="flex-1">{item.senderLabel}</Text>
            <Text className="w-20 text-right">{item.amount}</Text>
            <Text className="w-16 text-center">
              {item.shared ? 'Yes' : 'No'}
            </Text>
            <Text className="w-20 text-right">
              {item.sharedAmount ?? '-'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
