import React from 'react';
import { ScrollView, View } from 'react-native';
import { Button, List, Modal, Portal, ProgressBar, RadioButton, Text } from 'react-native-paper';

export type UploadModalProps = {
  visible: boolean;
  modalScreen: 'form' | 'processing';
  banks: any[];
  selectedBank: string | null;
  file: any | null;
  processingStmtId: string | null;
  processingLog: string;
  processingCompleted: boolean;
  onPickFile: () => void;
  onUpload: () => void;
  onCancelForm: () => void;
  onAbort: () => void;
  onClose: () => void;
  progress: Record<string, number>;
  setSelectedBank: (id: string | null) => void;
};

export default function UploadModal(props: UploadModalProps) {
  const {
    visible,
    modalScreen,
    banks,
    selectedBank,
    file,
    processingStmtId,
    processingLog,
    processingCompleted,
    onPickFile,
    onUpload,
    onCancelForm,
    onAbort,
    onClose,
    progress,
    setSelectedBank,
  } = props;

  return (
    <Portal>
      <Modal visible={visible} dismissable={false} contentContainerStyle={{ flex: 1, padding: 16, paddingTop: 64, backgroundColor: '#fff', height: '100%' }}>
        <View style={{ flex: 1 }}>
          {modalScreen === 'form' ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Upload bank statement</Text>
              <List.Section>
                <List.Subheader>Bank</List.Subheader>
                <RadioButton.Group onValueChange={(value) => setSelectedBank(value)} value={selectedBank ?? ''}>
                  {banks.map((b) => (
                    <RadioButton.Item key={b.id} label={b.label} value={b.id} />
                  ))}
                </RadioButton.Group>
              </List.Section>

              <List.Section>
                <List.Subheader>File</List.Subheader>
                <Button mode="contained" icon="file-upload" onPress={onPickFile} style={{ marginBottom: 8 }} accessibilityLabel="Pick PDF file">
                  Pick PDF file
                </Button>
                <Text style={{ fontSize: 12, color: 'gray', marginBottom: 8 }}>Only PDF files are allowed</Text>
                {file && <Text style={{ marginVertical: 8 }}>{file.name}</Text>}
              </List.Section>

              <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                <Button mode="contained" onPress={onUpload} style={{ marginRight: 8 }}>Upload</Button>
                <Button onPress={onCancelForm}>Cancel</Button>
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Processing statement</Text>
              <Text style={{ marginBottom: 12, color: 'gray' }}>Processing can take between 1-2 minutes. The log below shows processing updates.</Text>
              <View style={{ marginBottom: 12 }}>
                <ProgressBar progress={processingStmtId ? (progress[processingStmtId] ?? 0) : 0} />
              </View>

              <View style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 }}>
                <ScrollView>
                  <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>{processingLog}</Text>
                </ScrollView>
              </View>

              <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Button mode="outlined" onPress={onAbort}>Abort</Button>
                <Button mode="contained" onPress={onClose}>{processingCompleted ? 'Close' : 'Wait'}</Button>
              </View>
            </>
          )}
        </View>
      </Modal>
    </Portal>
  );
}
