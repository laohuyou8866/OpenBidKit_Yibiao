const { ipcMain, shell } = require('electron');

function registerExportIpc({ exportService }) {
  ipcMain.handle('export:word', async (event, payload = {}) => {
    const requestId = payload.requestId || payload.request_id;
    const sendProgress = (progress) => {
      event.sender.send('export:word-progress', { requestId, ...progress });
    };

    try {
      return await exportService.exportWord(payload, sendProgress);
    } catch (error) {
      sendProgress({
        phase: 'error',
        progress: 100,
        message: error.message || '导出 Word 失败',
      });
      throw error;
    }
  });

  // 用户取消结构确认即结束本次导出：没有需要保留的中间状态，保留通道以免调用方报未注册。
  ipcMain.handle('export:cancel-word-confirmation', () => undefined);

  ipcMain.handle('export:open-file', async (_event, filePath) => {
    const targetPath = String(filePath || '').trim();
    if (!targetPath) {
      throw new Error('缺少要打开的文件路径');
    }

    const errorMessage = await shell.openPath(targetPath);
    if (errorMessage) {
      throw new Error(`打开文件失败：${errorMessage}`);
    }

    return { success: true };
  });
}

module.exports = {
  registerExportIpc,
};
