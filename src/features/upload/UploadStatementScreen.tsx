import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { listBankAccounts, BankAccount } from '@/lib/bankAccounts';
import {
  createJob,
  updateJob,
  IngestionJob,
} from './ingestionStore';
import {
  uploadPdfAsync,
  requestParseAsync,
} from './openaiClient';
import { MAX_FILE_SIZE, DEFAULT_MODEL } from './constants';

interface PickedFile {
  name: string;
  uri: string;
  size: number;
}

export default function UploadStatementScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState<string>('');
  const [status, setStatus] = useState<IngestionJob['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    listBankAccounts().then(setAccounts);
  }, []);

  const selectFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.mimeType !== 'application/pdf') {
      Alert.alert('Only PDF files are supported');
      return;
    }
    if (asset.size && asset.size > MAX_FILE_SIZE) {
      Alert.alert('File too large (max 20MB)');
      return;
    }
    let size = asset.size ?? 0;
    if (!size) {
      const info = await FileSystem.getInfoAsync(asset.uri);
      size = info.size ?? 0;
    }
    setFile({ name: asset.name, uri: asset.uri, size });
  };

  const upload = async () => {
    if (!file || !accountId) return;
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return;
    setStatus('uploading');
    setProgress(10);
    const job = await createJob({
      status: 'uploading',
      accountId: account.id,
      accountLabel: account.label,
      fileName: file.name,
      fileUri: file.uri,
      fileSize: file.size,
      model: DEFAULT_MODEL,
    });
    setJobId(job.id);
    try {
      const { fileId } = await uploadPdfAsync({
        fileUri: file.uri,
        fileName: file.name,
      });
      setProgress(50);
      await updateJob(job.id, {
        status: 'uploaded',
        openaiFileId: fileId,
      });
      await updateJob(job.id, { status: 'processing' });
      setStatus('processing');
      const { rawResponseText } = await requestParseAsync({
        fileId,
        account: {
          id: account.id,
          label: account.label,
          classificationKey: account.classificationKey,
          parsingPrompt: account.prompt,
        },
        fileName: file.name,
      });
      setProgress(100);
      await updateJob(job.id, {
        status: 'done',
        rawResponseText,
      });
      setStatus('done');
    } catch (e: any) {
      const msg = e?.message ?? 'Unknown error';
      setError(msg);
      setStatus('failed');
      setProgress(0);
      if (jobId) {
        await updateJob(jobId, { status: 'failed', error: msg });
      }
    }
  };

  const retry = () => {
    setError(null);
    setStatus('idle');
    setProgress(0);
    upload();
  };

  const canUpload = !!file && !!accountId && status !== 'uploading' && status !== 'processing';

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" onPress={retry} />
        </View>
      )}
      <Button title="Select PDF" onPress={selectFile} />
      {file && (
        <View style={styles.fileInfo}>
          <Text>{file.name}</Text>
          <Text>{(file.size / 1024).toFixed(1)} KB</Text>
        </View>
      )}
      <Picker selectedValue={accountId} onValueChange={(v) => setAccountId(v)}>
        <Picker.Item label="Select account" value="" />
        {accounts.map((a) => (
          <Picker.Item key={a.id} label={a.label} value={a.id} />
        ))}
      </Picker>
      <Button title="Upload & Parse" onPress={upload} disabled={!canUpload} />
      <View style={styles.progressBar}>
        <View style={[styles.progress, { width: `${progress}%` }]} />
      </View>
      <Text>Status: {status}</Text>
      {(status === 'uploading' || status === 'processing') && <ActivityIndicator />}
      {status === 'done' && (
        <Button title="View uploads" onPress={() => router.push('/uploads')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fileInfo: { marginVertical: 16 },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    width: '100%',
    marginVertical: 16,
  },
  progress: { height: 8, backgroundColor: '#4a90e2' },
  errorBanner: {
    backgroundColor: '#fdd',
    padding: 8,
    marginBottom: 16,
  },
  errorText: { color: '#900', marginBottom: 4 },
});
