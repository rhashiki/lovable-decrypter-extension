'use strict';

importScripts(
  'editor-direct-runtime-v84.js',
  'supabase-project-manager-runtime-v84.js',
  'supabase-project-rename-runtime-v84.js',
  'github-sync-runtime-v84.js',
  'gemini-provider-runtime-v84.js'
);

Object.defineProperty(globalThis, 'LovableDecrypterBuild84ServiceWorker', {
  value: Object.freeze({
    build: 84,
    mode: 'event-driven',
    editorDirect: true,
    supabaseProjectManager: true,
    supabaseProjectRename: true,
    githubSyncHistory: true,
    geminiOptionalProvider: true,
    continuousPolling: false,
    globalObservers: false
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
