// Manual mock so any test that transitively pulls in lib/backup.ts doesn't try to
// load the native module. No test exercises real file IO.
module.exports = {
  __esModule: true,
  default: {
    fs: {
      dirs: { DownloadDir: '/storage/emulated/0/Download', CacheDir: '/tmp' },
      writeFile: jest.fn(async () => {}),
      readFile: jest.fn(async () => '{}'),
      exists: jest.fn(async () => false),
    },
  },
};
