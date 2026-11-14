jest.mock('../appLog', () => ({ appLog: { exportText: () => 'Kimacha diagnostics\n' } }));
jest.mock('../answerLog', () => ({ answerLog: { exportText: jest.fn() } }));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ uri: 'cache/log', create: jest.fn(), write: mockWrite })), Paths: { cache: 'cache' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
import { answerLog } from '../answerLog';
import { exportAppLog } from '../exportAppLog';
const mockWrite = jest.fn();
it('keeps the old bytes when empty and appends the answer section otherwise', async () => {
  (answerLog.exportText as jest.Mock).mockReturnValue('');
  await exportAppLog();
  expect(mockWrite).toHaveBeenLastCalledWith('Kimacha diagnostics\n');
  const section = 'Answer log\n1970-01-01T00:00:00.000Z en-es card thinkMs=1234 knew=1\n';
  (answerLog.exportText as jest.Mock).mockReturnValue(section);
  await exportAppLog();
  expect(mockWrite).toHaveBeenLastCalledWith(`Kimacha diagnostics\n\n${section}`);
});
