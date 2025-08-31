import { Entity, listBankAccounts } from './entities';

export async function loadBanksForModal(
  setBanks: (banks: Entity[]) => void,
  setModalVisible: (visible: boolean) => void
) {
  const b = await listBankAccounts();
  setBanks(b);
  setModalVisible(true);
}
