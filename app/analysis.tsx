import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SegmentedButtons, Text } from 'react-native-paper';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { summarizeExpensesByParent, ExpenseSummary } from '../lib/analytics';

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
  const [range, setRange] = useState<RangeKey>('ytd');
  const [data, setData] = useState<ExpenseSummary[]>([]);

  useEffect(() => {
    (async () => {
      const { start, end } = getRange(range);
      const res = await summarizeExpensesByParent(start, end);
      setData(res);
    })();
  }, [range]);

  const max = data.reduce((m, d) => Math.max(m, d.total), 0);
  const barWidth = 40;
  const gap = 20;
  const chartHeight = 180;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ height: chartHeight + 20 }}>
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
    </View>
  );
}
