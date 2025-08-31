import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { listStatementsWithMeta, StatementMeta } from '../lib/statements';

function StatusRow({ item }: { item: StatementMeta }) {
  const statuses = [
    { checked: true },
    { checked: item.processedAt !== null },
    { checked: item.reviewedAt !== null },
    { checked: item.publishedAt !== null },
  ];
  return (
    <View style={{ flexDirection: 'row', width: 80, justifyContent: 'space-between' }}>
      {statuses.map((s, i) => (
        <Text key={i}>{s.checked ? '[x]' : '[ ]'}</Text>
      ))}
    </View>
  );
}

export default function Index() {
  const [statements, setStatements] = useState<StatementMeta[]>([]);

  useEffect(() => {
    (async () => {
      const list = await listStatementsWithMeta();
      setStatements(list);
    })();
  }, []);

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={statements}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={<Text>No statements</Text>}
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 8,
              borderBottomWidth: 1,
            }}
          >
            <Text style={{ flex: 1 }}>{item.bankLabel}</Text>
            <Text style={{ flex: 1 }}>
              {new Date(item.uploadDate).toLocaleDateString()}
            </Text>
            <Text style={{ width: 40, textAlign: 'center' }}>
              {item.transactionCount}
            </Text>
            <StatusRow item={item} />
          </View>
        )}
      />
    </View>
  );
}
