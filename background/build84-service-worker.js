'use strict';

importScripts(
  'editor-direct-runtime-v84.js',
  'supabase-project-manager-runtime-v84.js',
  'supabase-project-rename-runtime-v84.js',
  'github-sync-runtime-v84.js',
  'gemini-provider-runtime-v84.js',
  'editor-model-gateway-bridge-v84.js',
  'context-intelligence-runtime-v84.js',
  'editor-context-scope-enforcement-v84.js',
  'editor-supabase-preflight-enforcement-v84.js',
  'editor-post-commit-verification-v84.js',
  'editor-progress-runtime-v84.js'
);

Object.defineProperty(globalThis, 'LovableDecrypterBuild84ServiceWorker', {
  value: Object.freeze({
    build: 84,
    mode: 'event-driven',
    editorDirect: true,
    editorModelGatewayBridge: true,
    editorProgress: true,
    editorProgressTruthfulMilestones: true,
    editorProgressSyntheticTime: false,
    localAiOptional: true,
    geminiByokFallback: true,
    crossProviderRetry: false,
    supabaseProjectManager: true,
    supabaseProjectRename: true,
    githubSyncHistory: true,
    geminiOptionalProvider: true,
    contextPack: true,
    projectBrainMemory: true,
    scopeIntelligence: true,
    editorContextScopeEnforcement: true,
    editorSupabasePreflightEnforcement: true,
    editorPostCommitVerification: true,
    scopeRequiredBeforeWrite: true,
    resourcePreflightRequiredBeforeReview: true,
    githubHeadRequiredAfterCommit: true,
    lovablePreviewAutomaticVerification: false,
    continuousPolling: false,
    globalObservers: false
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
