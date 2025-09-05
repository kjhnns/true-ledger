import { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  Button,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  IconButton,
  List,
} from 'react-native-paper';
import { Mode, Scope, Month } from '../lib/timeScope';

interface Props {
  scope: Scope;
  onChange(scope: Scope): void;
  onOpen?: (mode?: Mode) => void;
  onClose?: () => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TimeScopePicker({ scope, onChange }: Props) {
  const now = new Date();
  const [mode, setMode] = useState<Mode>(scope.mode);
  const [year, setYear] = useState(scope.mode === 'month' || scope.mode === 'year' ? scope.year : now.getFullYear());
  const [showCustom, setShowCustom] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const handleModeChange = (m: Mode) => {
    setMode(m);
    if (m === 'all') {
      onChange({ mode: 'all' });
    } else if (m === 'month') {
      onChange({
        mode: 'month',
        year,
        month: (scope.mode === 'month' ? scope.month : (now.getMonth() + 1)) as Month,
      });
    } else if (m === 'year') {
      onChange({ mode: 'year', year });
    } else {
      setShowCustom(true);
    }
  };

  const handleMonth = (m: number) => {
    onChange({ mode: 'month', year, month: m as Month });
  };

  const handleYear = (y: number) => {
    setYear(y);
    onChange({ mode: 'year', year: y });
  };

  const applyCustom = () => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    if (startDate.getTime() > endDate.getTime()) return;
    onChange({ mode: 'custom', startISO: startDate.toISOString(), endISO: endDate.toISOString() });
    setShowCustom(false);
  };

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= 1970; y--) years.push(y);

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'white',
        padding: 8,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        elevation: 3,
      }}
    >
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => handleModeChange(v as Mode)}
        buttons={[
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
          { value: 'all', label: 'All' },
          { value: 'custom', label: 'Custom' },
        ]}
      />
      {mode === 'month' && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <IconButton icon="chevron-left" onPress={() => setYear(year - 1)} />
            <Text>{year}</Text>
            <IconButton icon="chevron-right" onPress={() => setYear(year + 1)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MONTH_LABELS.map((label, idx) => (
              <Button
                key={label}
                mode={scope.mode === 'month' && scope.year === year && scope.month === idx + 1 ? 'contained' : 'text'}
                style={{ width: '33.33%' }}
                onPress={() => handleMonth(idx + 1)}
              >
                {label}
              </Button>
            ))}
          </View>
        </View>
      )}
      {mode === 'year' && (
        <ScrollView style={{ maxHeight: 200, marginTop: 8 }}>
          {years.map((y) => (
            <List.Item
              key={y}
              title={String(y)}
              onPress={() => handleYear(y)}
              right={() =>
                scope.mode === 'year' && scope.year === y ? <List.Icon icon="check" /> : null
              }
            />
          ))}
        </ScrollView>
      )}
      {mode === 'all' && (
        <View style={{ marginTop: 8 }}>
          <Text>All entries</Text>
        </View>
      )}
      <Portal>
        <Modal visible={showCustom} onDismiss={() => setShowCustom(false)}>
          <View style={{ padding: 16, backgroundColor: 'white' }}>
            <TextInput placeholder="Start ISO" value={start} onChangeText={setStart} />
            <TextInput placeholder="End ISO" value={end} onChangeText={setEnd} />
            <Button onPress={applyCustom}>Apply</Button>
            <Button onPress={() => setShowCustom(false)}>Cancel</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
