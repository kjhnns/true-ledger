import { useEffect, useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import {
  SegmentedButtons,
  Text,
  Card,
  Tooltip,
  DataTable,
  Button,
} from 'react-native-paper';
import {
  summarizeExpensesByParent,
  ExpenseSummary,
  computeKeyMetrics,
  KeyMetrics,
  countReviewedTransactions,
  summarizeReviewedTransactionsByBank,
  BankTransactionSummary,
  exportReviewedTransactionsToCsv,
} from '../lib/analytics';
import { listEntities } from '../lib/entities';
import { useRouter, useLocalSearchParams } from 'expo-router';

type RangeKey = '7d' | '1m' | 'qtd' | 'ytd';

function getRange(key: RangeKey): { start: number; end: number } {
  const now = new Date();
  const end = now.getTime();
  if (key === '7d') {
    const start = new Date(end - 7 * 24 * 60 * 60 * 1000).getTime();
    return { start, end };
  }
  if (key === '1m') {
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const start = startDate.getTime();
    const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: endDate.getTime() };
  }
  if (key === 'qtd') {
    const quarter = Math.floor(now.getMonth() / 3);
    const startDate = new Date(now.getFullYear(), quarter * 3, 1);
    return { start: startDate.getTime(), end };
  }
  const startDate = new Date(now.getFullYear(), 0, 1);
  return { start: startDate.getTime(), end };
}

export default function Analysis() {
  const router = useRouter();
  const { income: incomeParam, savings: savingsParam } =
    useLocalSearchParams<{
      income?: string;
      savings?: string;
    }>();
  const [range, setRange] = useState<RangeKey>('ytd');
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

  const handleExport = async () => {
    const { start, end } = getRange(range);
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
      const { start, end } = getRange(range);
      const res = await summarizeExpensesByParent(start, end);
      setData(res);
    })();
  }, [range]);

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
      const { start, end } = getRange(range);
      const res = await computeKeyMetrics(start, end, selectedIncome, selectedSavings);
      setMetrics(res);
      const [count, byBank] = await Promise.all([
        countReviewedTransactions(start, end),
        summarizeReviewedTransactionsByBank(start, end),
      ]);
      setReviewedCount(count);
      setBankSummary(byBank);
    })();
  }, [range, selectedIncome, selectedSavings]);

  const totalExpenses = data.reduce((sum, d) => sum + d.total, 0);
  const nf = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        <Card>
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
        <Text style={{ marginTop: 16 }}>
          Selected {reviewedCount} reviewed transactions for this timeframe
        </Text>
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
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          backgroundColor: 'white',
          borderRadius: 4,
          padding: 4,
        }}
      >
        <Button mode="contained" onPress={handleExport} style={{ marginBottom: 8 }}>
          Generate CSV export
        </Button>
        <SegmentedButtons
          value={range}
          onValueChange={(v) => setRange(v as RangeKey)}
          buttons={[
            { value: '7d', label: 'Last 7 days' },
            { value: '1m', label: 'Last month' },
            { value: 'qtd', label: 'Quarter to date' },
            { value: 'ytd', label: 'Year to date' },
          ]}
        />
      </View>
    </View>
  );
}
