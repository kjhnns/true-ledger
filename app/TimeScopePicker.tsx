import { useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  Button,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  IconButton,
  List,
  TextInput,
} from 'react-native-paper';
import { Mode, Scope, Month, MONTH_LABELS } from '../lib/timeScope';

interface Props {
  scope: Scope;
  onChange(scope: Scope): void;
  onOpen?: (mode?: Mode) => void;
  onClose?: () => void;
}

export default function TimeScopePicker({ scope, onChange }: Props) {
  const now = new Date();
  const [mode, setMode] = useState<Mode>(scope.mode);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(
    scope.mode === 'month' || scope.mode === 'year' ? scope.year : now.getFullYear()
  );
  const [showCustom, setShowCustom] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const lastChevron = useRef(0);

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const animate = () => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
    );
  };

  useEffect(() => {
    setMode(scope.mode);
    if (scope.mode === 'month' || scope.mode === 'year') {
      setYear(scope.year);
    }
  }, [scope]);

  const handleModeChange = (m: Mode) => {
    animate();
    setMode(m);
    if (m === 'all') {
      onChange({ mode: 'all' });
      setOpen(false);
    } else if (m === 'month') {
      onChange({
        mode: 'month',
        year,
        month: (scope.mode === 'month' ? scope.month : (now.getMonth() + 1)) as Month,
      });
      setOpen(true);
    } else if (m === 'year') {
      onChange({ mode: 'year', year });
      setOpen(true);
    } else {
      setShowCustom(true);
    }
  };

  const handleMonth = (m: number) => {
    onChange({ mode: 'month', year, month: m as Month });
    animate();
    setOpen(false);
  };

  const handleYear = (y: number) => {
    setYear(y);
    onChange({ mode: 'year', year: y });
    animate();
    setOpen(false);
  };

  const applyCustom = () => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    if (startDate.getTime() > endDate.getTime()) return;
    onChange({ mode: 'custom', startISO: startDate.toISOString(), endISO: endDate.toISOString() });
    setShowCustom(false);
    animate();
    setOpen(false);
  };

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= 1970; y--) years.push(y);

  const changeYear = (delta: number) => {
    const t = Date.now();
    if (t - lastChevron.current < 300) return;
    lastChevron.current = t;
    animate();
    setYear((y) => y + delta);
  };

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
        zIndex: 1,
      }}
    >
      <SegmentedButtons
        value={mode}
        onValueChange={(v) => handleModeChange(v as Mode)}
        buttons={[
          { value: 'month', label: 'Month', onPress: () => handleModeChange('month') },
          { value: 'year', label: 'Year', onPress: () => handleModeChange('year') },
          { value: 'all', label: 'All', onPress: () => handleModeChange('all') },
          { value: 'custom', label: 'Custom', onPress: () => handleModeChange('custom') },
        ]}
      />
      {open && mode === 'month' && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <IconButton icon="chevron-left" onPress={() => changeYear(-1)} />
            <Text>{year}</Text>
            <IconButton icon="chevron-right" onPress={() => changeYear(1)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {MONTH_LABELS.map((label, idx) => (
              <Button
                key={label}
                compact
                icon={
                  scope.mode === 'month' && scope.year === year && scope.month === idx + 1
                    ? 'check'
                    : undefined
                }
                mode="outlined"
                style={{ width: '33.33%', height: 44 }}
                accessibilityLabel={`${
                  scope.mode === 'month' && scope.year === year && scope.month === idx + 1
                    ? 'Selected'
                    : 'Select'
                } ${label} ${year}`}
                onPress={() => handleMonth(idx + 1)}
              >
                {label}
              </Button>
            ))}
          </View>
        </View>
      )}
      {open && mode === 'year' && (
        <ScrollView style={{ maxHeight: 200, marginTop: 8 }}>
          {years.map((y) => (
            <List.Item
              key={y}
              title={String(y)}
              onPress={() => handleYear(y)}
              accessibilityLabel={`${
                scope.mode === 'year' && scope.year === y ? 'Selected' : 'Select'
              } ${y}`}
              right={() =>
                scope.mode === 'year' && scope.year === y ? <List.Icon icon="check" /> : null
              }
            />
          ))}
        </ScrollView>
      )}
      <Portal>
        <Modal visible={showCustom} onDismiss={() => setShowCustom(false)}>
          <View style={{ padding: 16, backgroundColor: 'white' }}>
            <TextInput
              mode="outlined"
              placeholder="Start ISO"
              value={start}
              onChangeText={setStart}
            />
            <TextInput
              mode="outlined"
              placeholder="End ISO"
              value={end}
              onChangeText={setEnd}
            />
            <Button mode="outlined" onPress={applyCustom}>
              Apply
            </Button>
            <Button mode="outlined" onPress={() => setShowCustom(false)}>
              Cancel
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}
