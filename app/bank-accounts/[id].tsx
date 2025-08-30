import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { getBankAccount, updateBankAccount } from '../../lib/entities';
import BankAccountForm from './form';

export default function EditBankAccount() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] =
    useState<{ label: string; prompt: string } | null>(null);

  useEffect(() => {
    (async () => {
      const acct = await getBankAccount(id);
      if (acct) {
        setInitial({
          label: acct.label,
          prompt: acct.prompt,
        });
      }
    })();
  }, [id]);

  if (!initial) return null;

  return (
    <BankAccountForm
      initial={initial}
      submitLabel="Save"
      onSubmit={async (input) => {
        await updateBankAccount(id, input);
        router.back();
      }}
    />
  );
}
