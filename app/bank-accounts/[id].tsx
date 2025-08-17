import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import BankAccountForm from './form';
import { getBankAccount, updateBankAccount } from '../../lib/bankAccounts';

export default function EditBankAccount() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] =
    useState<{ label: string; prompt: string; classificationKey: string } | null>(null);

  useEffect(() => {
    (async () => {
      const acct = await getBankAccount(id);
      if (acct) {
        setInitial({
          label: acct.label,
          prompt: acct.prompt,
          classificationKey: acct.classificationKey,
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
