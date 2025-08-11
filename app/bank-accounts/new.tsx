import { router } from 'expo-router';
import BankAccountForm from './form';
import { createBankAccount } from '../../lib/bankAccounts';

export default function NewBankAccount() {
  return (
    <BankAccountForm
      submitLabel="Save"
      onSubmit={async (input) => {
        await createBankAccount(input);
        router.back();
      }}
    />
  );
}
