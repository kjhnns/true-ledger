import { Stack, router } from 'expo-router';
import BankAccountForm from './form';
import { createBankAccount } from '../../lib/entities';

export default function NewBankAccount() {
  return (
    <>
      <Stack.Screen options={{ title: 'New bank account' }} />
      <BankAccountForm
        submitLabel="Save"
        onSubmit={async (input) => {
          await createBankAccount(input);
          router.back();
        }}
      />
    </>
  );
}
