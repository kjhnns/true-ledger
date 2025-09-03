import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import {
  SegmentedButtons,
  Text,
  Card,
  Modal,
  Portal,
  Button,
  Chip,
  List,
  useTheme,
} from 'react-native-paper';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import {
  summarizeExpensesByParent,
  ExpenseSummary,
  computeKeyMetrics,
  KeyMetrics,
} from '../lib/analytics';
import { listEntities, Entity } from '../lib/entities';

type RangeKey = '7d' | '1m' | 'qtd' | 'ytd';

interface MetricModalProps {
  visible: boolean;
  title: string;
  entities: Entity[];
  selected: string[];
  onSave: (ids: string[]) => void;
  onDismiss: () => void;
}

function MetricModal({
  visible,
  title,
  entities,
  selected,
  onSave,
  onDismiss,
}: MetricModalProps) {
  const [current, setCurrent] = useState<string[]>(selected);
  const theme = useTheme();

  useEffect(() => {
    setCurrent(selected);
  }, [selected, visible]);

  const toggle = (id: string) => {
    setCurrent((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={{ margin: 20, flex: 1 }}
    >
      <View
        style={{
          backgroundColor: theme.colors.background,
          flex: 1,
          borderRadius: 12,
        }}
      >
        <View style={{ padding: 16 }}>
          <Text variant="headlineMedium">{title}</Text>
          <Text>Entities that sum to the metric</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {current.map((id) => {
              const ent = entities.find((e) => e.id === id);
              if (!ent) return null;
              return (
                <Chip key={id} onPress={() => toggle(id)} style={{ margin: 4 }}>
                  {ent.label}
                </Chip>
              );
            })}
          </View>
        </View>
        <Text style={{ marginHorizontal: 16, marginTop: 8, fontWeight: 'bold' }}>
          Select entities for metric
        </Text>
        <ScrollView style={{ flex: 1, marginTop: 8 }}>
          {entities.map((ent) => (
            <List.Item
              key={ent.id}
              title={ent.label}
              onPress={() => toggle(ent.id)}
            />
          ))}
        </ScrollView>
        <View style={{ padding: 16 }}>
          <Button mode="contained" onPress={() => onSave(current)}>
            Save
          </Button>
        </View>
      </View>
    </Modal>
  );
}

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
  const [range, setRange] = useState<RangeKey>('ytd');
  const [data, setData] = useState<ExpenseSummary[]>([]);
  const [metrics, setMetrics] = useState<KeyMetrics>({
    income: 0,
    expenses: 0,
    savings: 0,
    cashflow: 0,
  });
  const [incomeEntities, setIncomeEntities] = useState<Entity[]>([]);
  const [savingsEntities, setSavingsEntities] = useState<Entity[]>([]);
  const [selectedIncome, setSelectedIncome] = useState<string[]>([]);
  const [selectedSavings, setSelectedSavings] = useState<string[]>([]);
  const [modal, setModal] = useState<'income' | 'savings' | null>(null);

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
      setIncomeEntities(inc);
      setSavingsEntities(sav);
      setSelectedIncome(inc.map((e) => e.id));
      setSelectedSavings(sav.map((e) => e.id));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { start, end } = getRange(range);
      const res = await computeKeyMetrics(start, end, selectedIncome, selectedSavings);
      setMetrics(res);
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
              onPress={() => setModal('income')}
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
              onPress={() => setModal('savings')}
            >
              <Text variant="headlineMedium">Savings</Text>
              <Text>{nf.format(metrics.savings)}</Text>
            </TouchableOpacity>
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
      <Portal>
        <MetricModal
          visible={modal === 'income'}
          title="Define income"
          entities={incomeEntities}
          selected={selectedIncome}
          onSave={(ids) => {
            setSelectedIncome(ids);
            setModal(null);
          }}
          onDismiss={() => setModal(null)}
        />
        <MetricModal
          visible={modal === 'savings'}
          title="Define savings"
          entities={savingsEntities}
          selected={selectedSavings}
          onSave={(ids) => {
            setSelectedSavings(ids);
            setModal(null);
          }}
          onDismiss={() => setModal(null)}
        />
      </Portal>
    </View>
  );
}
