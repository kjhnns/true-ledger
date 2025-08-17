import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { listJobs, IngestionJob } from './ingestionStore';

export default function UploadsScreen() {
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  useEffect(() => {
    listJobs().then(setJobs);
  }, []);
  const renderItem = ({ item }: { item: IngestionJob }) => (
    <View style={{ padding: 12, borderBottomWidth: 1 }}>
      <Text>{item.fileName} - {item.status}</Text>
    </View>
  );
  return <FlatList data={jobs} keyExtractor={(j) => j.id} renderItem={renderItem} />;
}
