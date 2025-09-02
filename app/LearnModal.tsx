import React, { useState, useEffect } from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { Button, Checkbox, Modal, Portal, ProgressBar, Text } from 'react-native-paper';
import { Currency } from '../lib/currencies';
import * as SecureStore from 'expo-secure-store';
import {
  OPENAI_KEY_STORAGE_KEY,
  LEARN_PROMPT_STORAGE_KEY,
  DEFAULT_LEARN_PROMPT,
  learnFromTransactions,
} from '../lib/openai';
import { updateBankAccount } from '../lib/entities';
import { LearnTxn, prepareLearningTransactions } from '../lib/learn';

export type LearnModalProps = {
  visible: boolean;
  bank: { id: string; prompt: string; label: string; currency: Currency };
  transactions: LearnTxn[];
  onDismiss: () => void;
  onComplete: (prompt: string) => void;
};

export default function LearnModal({ visible, bank, transactions, onDismiss, onComplete }: LearnModalProps) {
  const [screen, setScreen] = useState<'select' | 'progress'>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState('');
  const [controller, setController] = useState<AbortController | null>(null);
  const [completed, setCompleted] = useState(false);

  const reset = () => {
    controller?.abort();
    setScreen('select');
    setSelected(new Set());
    setProgress(0);
    setLog('');
    setController(null);
    setCompleted(false);
  };

  useEffect(() => {
    if (!visible) reset();
  }, [visible]);

  const nf = new Intl.NumberFormat(undefined, { style: 'currency', currency: bank.currency || 'USD' });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const start = async () => {
    setScreen('progress');
    const apiKey = await SecureStore.getItemAsync(OPENAI_KEY_STORAGE_KEY);
    const base =
      (await SecureStore.getItemAsync(LEARN_PROMPT_STORAGE_KEY)) ??
      DEFAULT_LEARN_PROMPT;
    const list = prepareLearningTransactions(bank.id, transactions, selected);
    const ac = new AbortController();
    setController(ac);
    try {
      const newPrompt = await learnFromTransactions({
        bankPrompt: bank.prompt,
        basePrompt: base,
        transactions: list,
        apiKey: apiKey || '',
        onProgress: (p) => setProgress(p),
        onLog: (m) => setLog((l) => l + m + '\n'),
        signal: ac.signal,
      });
      await updateBankAccount(bank.id, { label: bank.label, prompt: newPrompt, currency: bank.currency });
      setLog((l) => l + 'saved prompt\n' + newPrompt + '\n');
      setCompleted(true);
      onComplete(newPrompt);
    } catch (e: any) {
      setLog((l) => l + `error: ${e.message || e}\n`);
      setCompleted(true);
    }
  };

  const abort = () => {
    controller?.abort();
    setLog((l) => l + 'aborted\n');
    setCompleted(true);
  };

  return (
    <Portal>
      <Modal visible={visible} dismissable={false} contentContainerStyle={{ flex: 1, padding: 16, paddingTop: 64, backgroundColor: '#fff', height: '100%' }}>
        {screen === 'select' ? (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8 }}>Learn mode</Text>
            <Text style={{ color: 'gray', marginBottom: 12 }}>Select the transactions that should be learned for this bank.</Text>
            <ScrollView style={{ flex: 1 }}>
              {transactions.map((t) => {
                const checked = selected.has(t.id);
                const isBankSender = t.senderId === bank.id;
                const subjectLabel = isBankSender ? t.recipientLabel : t.senderLabel;
                const amt = t.shared ? t.sharedAmount ?? t.amount : t.amount;
                const signed = isBankSender ? `- ${nf.format(amt)}` : `+ ${nf.format(amt)}`;
                return (
                  <TouchableOpacity key={t.id} onPress={() => toggle(t.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                    <Checkbox status={checked ? 'checked' : 'unchecked'} />
                    <View style={{ marginLeft: 8, flex: 1 }}>
                      <Text style={{ fontWeight: '700' }}>{subjectLabel || '-'}</Text>
                      <Text style={{ color: 'gray' }}>{t.description || '-'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {t.shared && <Text style={{ marginRight: 6, color: 'gray' }}>(shared)</Text>}
                      <Text>{signed}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Button onPress={onDismiss} style={{ marginRight: 8 }}>Cancel</Button>
              <Button mode="contained" onPress={start} disabled={selected.size === 0}>Learn</Button>
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Learning</Text>
            <View style={{ marginBottom: 12 }}>
              <ProgressBar progress={progress} />
            </View>
            <View style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 }}>
              <ScrollView>
                <Text selectable style={{ fontFamily: 'monospace', fontSize: 12 }}>{log}</Text>
              </ScrollView>
            </View>
            <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button mode="outlined" onPress={abort}>Abort</Button>
              <Button mode="contained" onPress={onDismiss} disabled={!completed}>
                {completed ? 'Close' : 'Wait'}
              </Button>
            </View>
          </View>
        )}
      </Modal>
    </Portal>
  );
}

