export type LearnTxn = {
  id: string;
  description: string | null;
  amount: number;
  shared: boolean;
  senderId: string | null;
  recipientId: string | null;
  senderLabel: string;
  recipientLabel: string;
};

export function prepareLearningTransactions(
  bankId: string,
  transactions: LearnTxn[],
  selected: Set<string>
) {
  return transactions
    .filter((t) => selected.has(t.id))
    .map((t) => ({
      description: t.description,
      amount: t.amount,
      shared: t.shared,
      category: t.senderId === bankId ? t.recipientId : t.senderId,
      type: t.senderId === bankId ? ('debit' as const) : ('credit' as const),
    }));
}
