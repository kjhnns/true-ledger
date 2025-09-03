import { useEffect, useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
  SegmentedButtons,
  Text,
  Card,
} from 'react-native-paper';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import {
  summarizeExpensesByParent,
  ExpenseSummary,
  computeKeyMetrics,
  KeyMetrics,
  countReviewedTransactions,
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
  });
  const [selectedIncome, setSelectedIncome] = useState<string[]>([]);
  const [selectedSavings, setSelectedSavings] = useState<string[]>([]);
  const [reviewedCount, setReviewedCount] = useState(0);

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
      if (selectedIncome.length === 0) setSelectedIncome(inc.map((e) => e.id));
      if (selectedSavings.length === 0) setSelectedSavings(sav.map((e) => e.id));
    })();
  }, []);

  useEffect(() => {
    if (incomeParam !== undefined)
      setSelectedIncome(
        String(incomeParam)
          .split(',')
          .filter((s) => s)
      );
    if (savingsParam !== undefined)
      setSelectedSavings(
        String(savingsParam)
          .split(',')
          .filter((s) => s)
      );
  }, [incomeParam, savingsParam]);

  useEffect(() => {
    (async () => {
      const { start, end } = getRange(range);
      const res = await computeKeyMetrics(start, end, selectedIncome, selectedSavings);
      setMetrics(res);
      const count = await countReviewedTransactions(start, end);
      setReviewedCount(count);
    })();
  }, [range, selectedIncome, selectedSavings]);

  const max = data.reduce((m, d) => Math.max(m, d.total), 0);
  const barWidth = 40;
  const gap = 20;
  const chartHeight = 180;
  const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

  return (
    <View style={{ flex: 1, padding: 16 }}>
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
                  params: { type: 'income', selected: selectedIncome.join(',') },
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
            <TouchableOpacity
              style={{ width: '50%', marginBottom: 12 }}
              onPress={() =>
                router.push({
                  pathname: '/analysis/entities',
                  params: { type: 'savings', selected: selectedSavings.join(',') },
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
      <View style={{ height: chartHeight + 20, marginTop: 16 }}>
        {data.length === 0 ? (
          <Text>No data</Text>
        ) : (
          <Svg height={chartHeight + 20} width={(barWidth + gap) * data.length}>
            {data.map((d, i) => {
              const h = max === 0 ? 0 : (d.total / max) * chartHeight;
              const x = i * (barWidth + gap);
              return (
                <>
                  <Rect
                    key={`bar-${d.parentId}`}
                    x={x}
                    y={chartHeight - h}
                    width={barWidth}
                    height={h}
                    fill="#6200ee"
                  />
                  <SvgText
                    key={`label-${d.parentId}`}
                    x={x + barWidth / 2}
                    y={chartHeight + 10}
                    fontSize="10"
                    fill="black"
                    textAnchor="middle"
                  >
                    {d.parentLabel}
                  </SvgText>
                </>
              );
            })}
          </Svg>
        )}
      </View>
      <Text style={{ marginTop: 16 }}>
        Selected {reviewedCount} reviewed transactions for this timeframe
      </Text>
      <SegmentedButtons
        value={range}
        onValueChange={(v) => setRange(v as RangeKey)}
        buttons={[
          { value: '7d', label: 'Last 7 days' },
          { value: '1m', label: 'Last month' },
          { value: 'qtd', label: 'Quarter to date' },
          { value: 'ytd', label: 'Year to date' },
        ]}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}
