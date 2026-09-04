(() => {
  'use strict';
  if (window.__LD84_PROJECT_AUTO_BINDING__) return;
  window.__LD84_PROJECT_AUTO_BINDING__ = true;

  const HOST_ID = 'lovable-decrypter-launcher';

  function send(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) return resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: chrome.runtime.lastError.message });
          resolve(response || { ok: false, code: 'EMPTY_RUNTIME_RESPONSE' });
        });
      } catch (error) {
        resolve({ ok: false, code: 'RUNTIME_MESSAGE_FAILED', message: error?.message || String(error) });
      }
    });
  }

  function snapshot() {
    let url;
    try { url = new URL(location.href); } catch (_) { return null; }
    const parts = url.pathname.split('/').filter(Boolean);
    let projectId = '';
    let workspaceId = '';
    for (const marker of ['projects', 'project']) {
      const i = parts.indexOf(marker);
      if (i >= 0 && parts[i + 1]) { projectId = parts[i + 1]; break; }
    }
    for (const marker of ['workspaces', 'workspace']) {
      const i = parts.indexOf(marker);
      if (i >= 0 && parts[i + 1]) { workspaceId = parts[i + 1]; break; }
    }
    return {
      detected: url.hostname === 'lovable.dev' || url.hostname.endsWith('.lovable.dev'),
      projectId: String(projectId || '').slice(0, 120),
      workspaceId: String(workspaceId || '').slice(0, 120),
      url: url.href,
      title: String(document.title || '').slice(0, 300),
      pathname: url.pathname,
      collectedAt: new Date().toISOString()
    };
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\|\s*lovable.*$/i, '')
      .replace(/\s+-\s+lovable.*$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  }

  function basename(value) {
    const text = String(value || '');
    return text.includes('/') ? text.split('/').pop() || text : text;
  }

  function scoreName(candidate, targets) {
    const c = normalize(candidate);
    if (!c || c.length < 2) return 0;
    let best = 0;
    for (const raw of targets) {
      const t = normalize(raw);
      if (!t) continue;
      if (c === t) best = Math.max(best, 100);
      else if (c.length >= 4 && t.length >= 4 && (c.includes(t) || t.includes(c))) best = Math.max(best, 92);
      else {
        const ca = new Set(c.split('-').filter(x => x.length > 2));
        const ta = new Set(t.split('-').filter(x => x.length > 2));
        const common = [...ca].filter(x => ta.has(x)).length;
        const denom = Math.max(ca.size, ta.size, 1);
        const similarity = common / denom;
        if (similarity >= .8) best = Math.max(best, 88);
        else if (similarity >= .66) best = Math.max(best, 78);
      }
    }
    return best;
  }

  function uniqueBest(candidates, targets, allowSingle = false) {
    const list = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
    if (!list.length) return null;
    if (allowSingle && list.length === 1) return { item: list[0], score: 100, reason: 'single-authorized-resource' };
    const ranked = list.map(item => ({ item, score: scoreName(item.name || item.label || item.id || '', targets) }))
      .sort((a, b) => b.score - a.score);
    const first = ranked[0];
    const second = ranked[1];
    if (!first || first.score < 90) return null;
    if (second && second.score >= first.score - 8) return null;
    return { ...first, reason: first.score === 100 ? 'exact-name-match' : 'strong-name-match' };
  }

  function resourceCandidates(status, integration) {
    return (Array.isArray(status?.available) ? status.available : []).map(item => ({
      id: String(item?.id || ''),
      name: String(item?.label || item?.id || ''),
      label: String(item?.label || ''),
      meta: String(item?.meta || ''),
      integration
    })).filter(item => item.id);
  }

  async function ensureSelected(integration, status, id) {
    if (!id || !status?.ok) return false;
    const selected = Array.isArray(status.selected) ? status.selected.map(String) : [];
    if (selected.includes(id)) return true;
    const union = [...new Set([...selected, id])];
    const saved = await send({ type: 'ld84.integration.resources.save', integration, selected: union });
    return saved?.ok === true;
  }

  async function ensure(options = {}) {
    const context = snapshot();
    if (!context?.detected || !context.projectId) return { ok: false, code: 'LOVABLE_PROJECT_ID_REQUIRED' };
    await send({ type: 'ld84.project.snapshot', context });

    let resources = await send({ type: 'ld84.editor.resources' });
    if (!resources?.ok) return resources;

    const [githubStatus, supabaseStatus] = await Promise.all([
      send({ type: 'ld84.integration.resources.status', integration: 'github' }),
      send({ type: 'ld84.integration.resources.status', integration: 'supabase' })
    ]);

    const githubAll = resourceCandidates(githubStatus, 'github');
    const supabaseAll = resourceCandidates(supabaseStatus, 'supabase');
    const binding = resources.binding || {};

    let repository = String(binding.repository || '');
    let repoMatch = null;
    if (repository && githubAll.some(item => item.id === repository)) {
      repoMatch = { item: githubAll.find(item => item.id === repository), score: 100, reason: 'existing-binding' };
    } else {
      const titleTargets = [context.title, document.title];
      repoMatch = uniqueBest(
        githubAll.map(item => ({ ...item, name: basename(item.id) })),
        titleTargets,
        githubAll.length === 1
      );
      repository = repoMatch?.item?.id || '';
    }

    if (!repository) return { ok: false, code: 'AUTO_BIND_GITHUB_AMBIGUOUS', projectId: context.projectId };
    await ensureSelected('github', githubStatus, repository);

    const repoBase = basename(repository);
    let supabaseProject = String(binding.supabaseProject || '');
    let supabaseMatch = null;
    if (supabaseProject && supabaseAll.some(item => item.id === supabaseProject)) {
      supabaseMatch = { item: supabaseAll.find(item => item.id === supabaseProject), score: 100, reason: 'existing-binding' };
    } else {
      supabaseMatch = uniqueBest(supabaseAll, [repoBase, context.title], false);
      supabaseProject = supabaseMatch?.item?.id || '';
    }

    if (supabaseProject) await ensureSelected('supabase', supabaseStatus, supabaseProject);

    resources = await send({ type: 'ld84.editor.resources' });
    if (!resources?.ok) return resources;
    const repoInfo = (resources.repositories || []).find(item => item.fullName === repository);
    if (!repoInfo) return { ok: false, code: 'AUTO_BIND_REPOSITORY_NOT_AVAILABLE', repository };
    if (supabaseProject && !(resources.supabaseProjects || []).some(item => item.ref === supabaseProject)) {
      supabaseProject = '';
    }

    const current = resources.binding || {};
    const unchanged = current.repository === repository && String(current.supabaseProject || '') === String(supabaseProject || '');
    if (unchanged) {
      return {
        ok: true,
        changed: false,
        projectId: context.projectId,
        binding: current,
        match: { github: repoMatch?.reason || 'existing-binding', supabase: supabaseMatch?.reason || (supabaseProject ? 'existing-binding' : 'unresolved') }
      };
    }

    const saved = await send({
      type: 'ld84.editor.bind',
      projectId: context.projectId,
      repository,
      branch: repoInfo.defaultBranch || current.branch || 'main',
      supabaseProject
    });
    if (!saved?.ok) return saved;

    const detail = {
      projectId: context.projectId,
      binding: saved.binding,
      match: {
        github: repoMatch?.reason || 'strong-name-match',
        supabase: supabaseMatch?.reason || (supabaseProject ? 'strong-name-match' : 'unresolved')
      }
    };
    window.dispatchEvent(new CustomEvent('ld84:auto-binding', { detail }));
    return { ok: true, changed: true, ...detail };
  }

  Object.defineProperty(window, 'LovableDecrypterAutoBindingV84', {
    value: Object.freeze({ ensure }), configurable: false, enumerable: false, writable: false
  });

  const run = () => ensure({ source: 'page-load' }).catch(() => {});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();