import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell } from 'electron'
import path from 'node:path'
import { setupCSP } from './utils/csp'
import { initDb, closeDb, getDbPath } from './db'
import { registerIpc } from './ipc'
import { scheduleAutoBackup } from './utils/autoBackup'

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0b0f1a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      devTools: isDev,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isDev && url.startsWith(DEV_URL)) return
    e.preventDefault()
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer crashed]', details.reason)
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault())
})

process.on('uncaughtException', (err) => {
  console.error('[uncaught]', err)
  if (app.isReady()) {
    dialog.showErrorBox(
      'Yumi POS — error inesperado',
      `${err.message}\n\nLa base de datos está en:\n${getDbPath()}`,
    )
  }
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandled rejection]', reason)
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    setupCSP(session.defaultSession, isDev)
    try {
      initDb()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      dialog.showErrorBox(
        'Yumi POS — no se pudo iniciar',
        `Error abriendo la base de datos.\n${msg}\n\nRuta esperada:\n${getDbPath()}`,
      )
      app.exit(1)
      return
    }
    registerIpc()

    // Controles de ventana expuestos al renderer (LoginDialog usa
    // estos para que la cajera pueda salir si se equivocó al hacer
    // logout y no sabe ningún PIN).
    ipcMain.on('win:minimize', () => mainWindow?.minimize())
    ipcMain.on('win:close', () => app.quit())

    scheduleAutoBackup()
    if (!isDev) Menu.setApplicationMenu(null)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDb()
})
