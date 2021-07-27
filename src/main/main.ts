import path from 'path';
import electron from 'electron';
import installExtension, { REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS, REACT_PERF } from 'electron-devtools-installer';

import IpcModule from './modules/ipc';
import ApplicationMenuModule from './modules/application-menu';
import TrayModule from './modules/tray';
import ConfigModule from './modules/config';
import PowerModule from './modules/power-monitor';
import ThumbarModule from './modules/thumbar';
import DockMenuModule from './modules/dock-menu-darwin';
import GlobalShortcutsModule from './modules/global-shortcuts';
import SleepBlockerModule from './modules/sleep-blocker';
import MprisModule from './modules/mpris';
import DialogsModule from './modules/dialogs';

import * as ModulesManager from './lib/modules-manager';
import { checkBounds } from './lib/utils';

const { app, BrowserWindow } = electron;

const isProduction = process.env.NODE_ENV === 'production';

const appRoot = path.resolve(__dirname, '../..'); // Careful, not future-proof
const rendererDistPath = path.join(appRoot, 'dist', 'renderer');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the javascript object is GCed.
let mainWindow: Electron.BrowserWindow | null = null;

// Make the app a single-instance app
const gotTheLock = app.requestSingleInstanceLock();

app.on('second-instance', () => {
  // Someone tried to run a second instance, we should focus our window.
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (!gotTheLock) {
  app.quit();
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});

// Let's list the list of modules we will use for Museeks

// This method will be called when Electron has finished its
// initialization and ready to create browser windows.
app.on('ready', async () => {
  // Let's install some extensions so it's easier for us to debug things
  if (!isProduction) {
    installExtension([REDUX_DEVTOOLS, REACT_DEVELOPER_TOOLS, REACT_PERF])
      .then((name) => console.info(`[INFO] Added Extension: ${name}`))
      .catch((err) => console.info('[WARN] An error occurred while trying to add extensions: ', err));
  }

  const configModule = new ConfigModule();
  await ModulesManager.init(configModule);

  const config = configModule.getConfig();
  const bounds = checkBounds(config.bounds);

  // Create the browser window
  mainWindow = new BrowserWindow({
    title: 'Museeks',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 550,
    frame: true,
    autoHideMenuBar: false,
    titleBarStyle: 'hiddenInset', // MacOS polished window
    show: false,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  // ... and load the html page generated by Webpack
  mainWindow.loadURL(`file://${rendererDistPath}/index.html#/library`);

  // Open dev tools if museeks is run in debug mode
  if (process.argv.includes('--devtools')) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Click on the dock icon to show the app again on macOS
  app.on('activate', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Prevent webContents from opening new windows (e.g ctrl-click on link)
  mainWindow.webContents.on('new-window', (e) => {
    e.preventDefault();
  });

  ModulesManager.init(
    new IpcModule(mainWindow, configModule),
    new PowerModule(mainWindow),
    new ApplicationMenuModule(mainWindow),
    new TrayModule(mainWindow, configModule),
    new ThumbarModule(mainWindow),
    new DockMenuModule(mainWindow),
    new GlobalShortcutsModule(mainWindow),
    new SleepBlockerModule(mainWindow),
    new MprisModule(mainWindow),
    new DialogsModule(mainWindow)
  ).catch(console.error);
});
