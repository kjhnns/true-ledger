import { useCallback, useState } from 'react';
import { Alert, Button, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  BankAccount,
  listBankAccounts,
  deleteBankAccount,
} from '../../lib/entities';

export default function BankAccountsList() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const load = useCallback(async () => {
    const data = await listBankAccounts();
    setAccounts(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const confirmDelete = (id: string) => {
    Alert.alert('Delete account?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBankAccount(id);
          load();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: BankAccount }) => (
    <View className="flex-row items-center p-4 border-b">
      <TouchableOpacity
        className="flex-1"
        onPress={() => router.push(`/bank-accounts/${item.id}`)}
      >
        <Text className="text-base">{item.label}</Text>
      </TouchableOpacity>
      <Button title="Delete" onPress={() => confirmDelete(item.id)} />
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList data={accounts} keyExtractor={(i) => i.id} renderItem={renderItem} />
      <View className="p-4">
        <Button
          title="+ Add bank account"
          onPress={() => router.push('/bank-accounts/new')}
        />
      </View>
    </View>
  );
}
