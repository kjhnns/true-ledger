import React, { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Modal, ProgressBar, Text, useTheme } from 'react-native-paper';

export type ProcessingModalProps = {
  visible: boolean;
  title?: string;
  log: string;
  progress: number;
  done: boolean;
  onClose: () => void;
  onAbort?: () => void;
};

export default function ProcessingModal({
  visible,
  title = 'Processing statement',
  log,
  progress,
  done,
  onClose,
  onAbort,
}: ProcessingModalProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [log]);
  return (
    <Modal
      visible={visible}
      dismissable={false}
      contentContainerStyle={{
        flex: 1,
        padding: 16,
        paddingTop: 64,
        backgroundColor: theme.colors.background,
        height: '100%',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>{title}</Text>
        <Text style={{ marginBottom: 12, color: 'gray' }}>
          Processing can take between 1-2 minutes. The log below shows processing updates.
        </Text>
        <View style={{ marginBottom: 12 }}>
          <ProgressBar progress={progress} />
        </View>
        <View style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 }}>
          <ScrollView ref={scrollRef}>
            <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {log}
            </Text>
          </ScrollView>
        </View>
        <View
          style={{
            marginTop: 12,
            flexDirection: 'row',
            justifyContent: onAbort ? 'space-between' : 'flex-end',
          }}
        >
          {onAbort && <Button mode="outlined" onPress={onAbort}>Abort</Button>}
          <Button mode="outlined" onPress={onClose} disabled={!done}>
            {done ? 'Close' : 'Wait'}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

