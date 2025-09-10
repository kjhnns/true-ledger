import { useEffect, useRef, useState } from 'react';
import {
  LayoutAnimation,
  ScrollView,
  View
} from 'react-native';
import {
  Button,
  IconButton,
  List,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { Mode, Month, MONTH_LABELS, Scope } from '../lib/timeScope';

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
  const [previewMonth, setPreviewMonth] = useState<number | null>(
    scope.mode === 'month' ? (scope.month as number) : null
  );
  const [previewYear, setPreviewYear] = useState<number | null>(
    scope.mode === 'year' ? scope.year : null
  );
  const [showCustom, setShowCustom] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const lastChevron = useRef(0);

  // if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  //   UIManager.setLayoutAnimationEnabledExperimental(true);
  // }

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
    // keep local previews in sync with incoming scope
    if (scope.mode === 'month') {
      setPreviewMonth(scope.month as number);
      setPreviewYear(null);
    } else if (scope.mode === 'year') {
      setPreviewYear(scope.year);
      setPreviewMonth(null);
    } else {
      setPreviewMonth(null);
      setPreviewYear(null);
    }
  }, [scope]);

  const handleModeChange = (m: Mode) => {
    animate();
    setMode(m);
    // only the clicked segment should show its selected label
    if (m === 'all') {
      setPreviewMonth(null);
      setPreviewYear(null);
    }
    if (m === 'all') {
      onChange({ mode: 'all' });
      setOpen(false);
    } else if (m === 'month') {
      // show a preview month immediately; keep year label default
      const pm = (scope.mode === 'month' ? (scope.month as number) : (now.getMonth() + 1));
      setPreviewMonth(pm);
      setPreviewYear(null);
      onChange({ mode: 'month', year, month: pm as Month });
      setOpen(true);
    } else if (m === 'year') {
      // show a preview year immediately; keep month label default
      setPreviewYear(year);
      setPreviewMonth(null);
      onChange({ mode: 'year', year });
      setOpen(true);
    } else {
      setShowCustom(true);
    }
  };

  const handleMonth = (m: number) => {
  setPreviewMonth(m);
  setPreviewYear(null);
  onChange({ mode: 'month', year, month: m as Month });
    animate();
    setOpen(false);
  };

  const handleYear = (y: number) => {
  setYear(y);
  setPreviewYear(y);
  setPreviewMonth(null);
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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/** compute labels so only the active segment shows a preview value */}
          {
            (() => {
              let monthLabel = 'Month';
              let yearLabel = 'Year';
              if (previewMonth !== null && typeof previewMonth === 'number') {
                monthLabel = MONTH_LABELS[previewMonth - 1];
              }
              if (previewYear !== null && typeof previewYear === 'number') {
                yearLabel = String(previewYear);
              }
              return (
                <SegmentedButtons
                  style={{ flex: 1 }}
                  value={mode}
                  onValueChange={(v) => handleModeChange(v as Mode)}
                  buttons={[
                    { value: 'month', label: monthLabel },
                    { value: 'year', label: yearLabel },
                    { value: 'all', label: 'All' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              );
            })()
          }
        <IconButton
          icon={open ? 'chevron-down' : 'chevron-up'}
          accessibilityLabel={open ? 'Hide time options' : 'Show time options'}
          onPress={() => {
            if (mode === 'month' || mode === 'year') {
              animate();
              setOpen((o) => !o);
            }
          }}
        />
      </View>
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
