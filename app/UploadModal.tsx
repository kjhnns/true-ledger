import React from 'react';
import { View } from 'react-native';
import { Button, List, Modal, Portal, RadioButton, Text } from 'react-native-paper';
import ProcessingModal from './ProcessingModal';

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
      {modalScreen === 'form' ? (
        <Modal
          visible={visible}
          dismissable={false}
          contentContainerStyle={{ flex: 1, padding: 16, paddingTop: 64, backgroundColor: '#fff', height: '100%' }}
        >
          <View style={{ flex: 1 }}>
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
              <Button
                mode="outlined"
                icon="file-upload"
                onPress={onPickFile}
                style={{ marginBottom: 8 }}
                accessibilityLabel="Pick PDF file"
              >
                Pick PDF file
              </Button>
              <Text style={{ fontSize: 12, color: 'gray', marginBottom: 8 }}>Only PDF files are allowed</Text>
              {file && <Text style={{ marginVertical: 8 }}>{file.name}</Text>}
            </List.Section>

            <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
              <Button mode="outlined" onPress={onUpload} style={{ marginRight: 8 }}>
                Upload
              </Button>
              <Button mode="outlined" onPress={onCancelForm}>
                Cancel
              </Button>
            </View>
          </View>
        </Modal>
      ) : (
        <ProcessingModal
          visible={visible}
          log={processingLog}
          progress={processingStmtId ? (progress[processingStmtId] ?? 0) : 0}
          done={processingCompleted}
          onClose={onClose}
          onAbort={onAbort}
        />
      )}
    </Portal>
  );
}
