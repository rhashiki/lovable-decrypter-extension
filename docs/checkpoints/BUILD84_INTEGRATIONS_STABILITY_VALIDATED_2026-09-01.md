# Build 84 — Checkpoint validado: Integrações + Estabilidade

Data de validação no navegador: 2026-09-01

## Autoridade do checkpoint

- Branch: `v2.6.84-clean-functional-runtime`
- Candidato validado pelo usuário: commit `938da1e5d36c2a702b1e809dd090af80d85eb0b8`
- Build: `2.6.84`
- Escopo: estabilidade do Lovable/RAM, UI canônica, Conta/Trust, GitHub, Supabase, Project State e gerenciamento de recursos de integração.

## Resultado de validação real no Chrome

- Lovable continua carregando normalmente: **VALIDADO**.
- RAM estabiliza e não apresenta crescimento contínuo: **VALIDADO**.
- Rail/FAB e layout sem sobreposição: **VALIDADO**.
- `Abrir módulo`, `Ver estado` e `Detalhes` possuem comportamentos distintos: **VALIDADO**.
- Monitor ON/OFF persiste e altera o indicador do FAB: **VALIDADO**.
- GitHub App connect/status: **VALIDADO**.
- Supabase OAuth connect/status: **VALIDADO**.
- Gerenciamento de repositórios GitHub, aninhado somente em GitHub e sem duplicidade: **VALIDADO**.
- Gerenciamento de projetos Supabase, aninhado somente em Supabase e sem duplicidade: **VALIDADO**.
- Aparência das ações de gerenciamento consistente com as demais opções do submenu: **VALIDADO**.
- Editor Direto existe no rail, mas neste checkpoint permanece apenas como superfície, sem motor de comandos: **NÃO FAZ PARTE DA VALIDAÇÃO FUNCIONAL DESTE CHECKPOINT**.

## Invariantes arquiteturais preservados

- `MutationObserver` global: 0.
- `setInterval` de content runtime: 0.
- polling contínuo: 0.
- `shell.inert` no Lovable: proibido/ausente.
- mount/composer guardians: não enviados.
- autoridade visual: uma única UI Shadow DOM.
- runtime pesado no boot: 0.
- remoção de repositório/projeto no Decrypter nunca exclui o recurso externo.

## Próximo checkpoint isolado

**Editor Direto / command path.**

Contrato a preservar:

1. IA local é a autoridade de interpretação/orquestração do comando.
2. `Plan` é zero-write.
3. `Build` prepara Shadow Build/patches antes de qualquer escrita.
4. Escrita exige revisão/aprovação explícita.
5. GitHub é a autoridade do código e deve ter HEAD/scope revalidados antes do apply.
6. Supabase é a autoridade do backend quando o pedido exigir backend.
7. Lovable é ambiente/Preview; não recebe o prompt como autoridade de IA.
8. Nenhuma reintrodução de observers, polling, monkeypatch de transporte ou interceptação contínua do composer nativo.

Este arquivo é um checkpoint de homologação, não uma Release e não autoriza merge em `main`, publicação OTA ou Chrome Store.
