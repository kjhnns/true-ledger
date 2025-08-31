import { loadBanksForModal } from '../lib/banks';
import { listBankAccounts } from '../lib/entities';

jest.mock('../lib/entities', () => ({
  listBankAccounts: jest.fn(),
}));

test('loadBanksForModal fetches banks and shows modal', async () => {
  const mockBanks = [{ id: '1', label: 'B', category: 'bank', prompt: '', currency: 'USD', parentId: null }];
  (listBankAccounts as jest.Mock).mockResolvedValue(mockBanks);
  const setBanks = jest.fn();
  const setModalVisible = jest.fn();
  await loadBanksForModal(setBanks, setModalVisible);
  expect(listBankAccounts).toHaveBeenCalledTimes(1);
  expect(setBanks).toHaveBeenCalledWith(mockBanks);
  expect(setModalVisible).toHaveBeenCalledWith(true);
});
