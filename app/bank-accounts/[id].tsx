import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { getBankAccount, updateBankAccount } from '../../lib/entities';
import BankAccountForm from './form';

export default function EditBankAccount() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] =
    useState<{ label: string; prompt: string; currency: string } | null>(null);

  useEffect(() => {
    (async () => {
      const acct = await getBankAccount(id);
      if (acct) {
        setInitial({
          label: acct.label,
          prompt: acct.prompt,
          currency: acct.currency,
        });
      }
    })();
  }, [id]);

  if (!initial) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'Edit bank account' }} />
      <BankAccountForm
        initial={initial}
        submitLabel="Save"
        onSubmit={async (input) => {
          await updateBankAccount(id, input);
          router.back();
        }}
      />
    </>
  );
}
