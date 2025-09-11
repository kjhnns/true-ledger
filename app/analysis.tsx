import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { Button, Card, DataTable, Text, Tooltip } from 'react-native-paper';
import {
  BankTransactionSummary,
  ExpenseSummary,
  KeyMetrics,
  computeKeyMetrics,
  countReviewedTransactions,
  exportReviewedTransactionsToCsv,
  summarizeExpensesByParent,
  summarizeReviewedTransactionsByBank,
} from '../lib/analytics';
import { listEntities } from '../lib/entities';
import { Month, Scope, scopeToRange } from '../lib/timeScope';
import TimeScopePicker from './TimeScopePicker';

export default function Analysis({
  showTitle = true,
}: {
  showTitle?: boolean;
}) {
  const router = useRouter();
  const { income: incomeParam, savings: savingsParam } =
    useLocalSearchParams<{
      income?: string;
      savings?: string;
    }>();
  const now = new Date();
  const [scope, setScope] = useState<Scope>({
    mode: 'month',
    year: now.getFullYear(),
    month: (now.getMonth() + 1) as Month,
  });
  const [data, setData] = useState<ExpenseSummary[]>([]);
  const [metrics, setMetrics] = useState<KeyMetrics>({
    income: 0,
    expenses: 0,
    savings: 0,
    cashflow: 0,
    savingsRatio: 0,
    splitCredit: 0,
  });
  const [selectedIncome, setSelectedIncome] = useState<string[]>([]);
  const [selectedSavings, setSelectedSavings] = useState<string[]>([]);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [bankSummary, setBankSummary] = useState<BankTransactionSummary[]>([]);



  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync('time-scope');
      if (stored) {
        try {
          const parsed: Scope = JSON.parse(stored);
          setScope(parsed);
        } catch {}
      }
    })();
  }, []);

  const handleScopeChange = (s: Scope) => {
    setScope(s);
    SecureStore.setItemAsync('time-scope', JSON.stringify(s));
  };

  const handleExport = async () => {
    const { start, end } = scopeToRange(scope);
    const csv = await exportReviewedTransactionsToCsv(start, end);
    const FileSystem = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const uri = `${FileSystem.cacheDirectory}reviewed-transactions-${start}-${end}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(uri, { mimeType: 'text/csv' });
  };

  useEffect(() => {
    (async () => {
      const { start, end } = scopeToRange(scope);
      const res = await summarizeExpensesByParent(start, end);
      setData(res);
    })();
  }, [scope]);

  useEffect(() => {
    (async () => {
      const [inc, sav] = await Promise.all([
        listEntities('income'),
        listEntities('savings'),
      ]);
      if (incomeParam !== undefined) {
        setSelectedIncome(
          String(incomeParam)
            .split(',')
            .filter((s) => s)
        );
      } else if (selectedIncome.length === 0) {
        setSelectedIncome(inc.map((e) => e.id));
      }
      if (savingsParam !== undefined) {
        setSelectedSavings(
          String(savingsParam)
            .split(',')
            .filter((s) => s)
        );
      } else if (selectedSavings.length === 0) {
        setSelectedSavings(sav.map((e) => e.id));
      }
    })();
  }, [incomeParam, savingsParam, selectedIncome.length, selectedSavings.length]);

  useEffect(() => {
    (async () => {
      const { start, end } = scopeToRange(scope);
      const res = await computeKeyMetrics(start, end, selectedIncome, selectedSavings);
      setMetrics(res);
      const [count, byBank] = await Promise.all([
        countReviewedTransactions(start, end),
        summarizeReviewedTransactionsByBank(start, end),
      ]);
      setReviewedCount(count);
      setBankSummary(byBank);
    })();
  }, [scope, selectedIncome, selectedSavings]);

  const totalExpenses = data.reduce((sum, d) => sum + d.total, 0);
  const nf = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  });

  return (
    <View style={{ flex: 1 }}>
      {showTitle && <Stack.Screen options={{ title: 'Analysis' }} />}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <Text style={{ marginBottom: 16 }}>
          Selected {reviewedCount} reviewed transactions for this timeframe
        </Text>
        <Card mode="outlined" style={{ elevation: 0 }}>
          <Card.Content>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <View style={{ width: '50%', marginBottom: 12 }}>
              <Text variant="headlineMedium">Cashflow</Text>
              <Text>{nf.format(metrics.cashflow)}</Text>
            </View>
            <TouchableOpacity
              style={{ width: '50%', marginBottom: 12 }}
              onPress={() =>
                router.push({
                  pathname: '/analysis/entities',
                  params: {
                    type: 'income',
                    selected: selectedIncome.join(','),
                    savings: selectedSavings.join(','),
                  },
                })
              }
            >
              <Text variant="headlineMedium">Income</Text>
              <Text>{nf.format(metrics.income)}</Text>
            </TouchableOpacity>
            <View style={{ width: '50%', marginBottom: 12 }}>
              <Text variant="headlineMedium">Expenses</Text>
              <Text>{nf.format(metrics.expenses)}</Text>
            </View>
            <View style={{ width: '50%', marginBottom: 12 }}>
              <Tooltip title={"Amount minus\nshared portions of reviewed\nshared transactions"}>
                <Text variant="headlineMedium">Split Credit</Text>
              </Tooltip>
              <Text>{nf.format(metrics.splitCredit)}</Text>
            </View>
            <TouchableOpacity
              style={{ width: '50%', marginBottom: 12 }}
              onPress={() =>
                router.push({
                  pathname: '/analysis/entities',
                  params: {
                    type: 'savings',
                    selected: selectedSavings.join(','),
                    income: selectedIncome.join(','),
                  },
                })
              }
            >
              <Text variant="headlineMedium">Savings</Text>
              <Text>{nf.format(metrics.savings)}</Text>
            </TouchableOpacity>
            <View style={{ width: '50%', marginBottom: 12 }}>
              <Text variant="headlineMedium">Savings Ratio</Text>
              <Text>{Math.round(metrics.savingsRatio * 100)}%</Text>
            </View>
          </View>
          </Card.Content>
        </Card>
        {data.length === 0 ? (
          <Text style={{ marginTop: 16 }}>No data</Text>
        ) : (
          <DataTable style={{ marginTop: 16 }}>
            <DataTable.Header>
              <DataTable.Title>Expense</DataTable.Title>
              <DataTable.Title numeric>Amount</DataTable.Title>
              <DataTable.Title numeric>% of total</DataTable.Title>
            </DataTable.Header>
            {data.map((d) => (
              <DataTable.Row key={d.parentId}>
                <DataTable.Cell>{d.parentLabel}</DataTable.Cell>
                <DataTable.Cell numeric>{nf.format(d.total)}</DataTable.Cell>
                <DataTable.Cell numeric>
                  {totalExpenses === 0
                    ? '0%'
                    : `${Math.round((d.total / totalExpenses) * 100)}%`}
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        )}
        {bankSummary.length > 0 && (
          <DataTable style={{ marginTop: 16 }}>
            <DataTable.Header>
              <DataTable.Title>Bank</DataTable.Title>
              <DataTable.Title numeric>Count</DataTable.Title>
              <DataTable.Title numeric>Total</DataTable.Title>
            </DataTable.Header>
            {bankSummary.map((b) => (
              <DataTable.Row key={b.bankId}>
                <DataTable.Cell>{b.bankLabel}</DataTable.Cell>
                <DataTable.Cell numeric>{b.count}</DataTable.Cell>
                <DataTable.Cell numeric>{nf.format(b.total)}</DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable>
        )}
        <Button mode="outlined" onPress={handleExport} style={{ marginTop: 16 }}>
          Generate CSV export
        </Button>
      </ScrollView>
      <TimeScopePicker scope={scope} onChange={handleScopeChange} />
    </View>
  );
}
