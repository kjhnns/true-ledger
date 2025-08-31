import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { DataTable, Text } from 'react-native-paper';
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

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {transactions.length === 0 ? (
        <Text>No transactions</Text>
      ) : (
        <ScrollView>
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>Recipient</DataTable.Title>
              <DataTable.Title>Sender</DataTable.Title>
              <DataTable.Title numeric>Amount</DataTable.Title>
              <DataTable.Title style={{ justifyContent: 'center', width: 64 }}>
                Shared
              </DataTable.Title>
              <DataTable.Title numeric>Shared Amt</DataTable.Title>
            </DataTable.Header>
            {transactions.map((item) => (
              <DataTable.Row key={item.id}>
                <DataTable.Cell>{item.recipientLabel}</DataTable.Cell>
                <DataTable.Cell>{item.senderLabel}</DataTable.Cell>
                <DataTable.Cell numeric>{item.amount}</DataTable.Cell>
                <DataTable.Cell style={{ justifyContent: 'center', width: 64 }}>
                  {item.shared ? 'Yes' : 'No'}
                </DataTable.Cell>
                <DataTable.Cell numeric>
                  {item.sharedAmount ?? '-'}
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        </ScrollView>
      )}
    </View>
  );
}
