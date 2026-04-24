# Ollama Cloud Provider Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Ollama Cloud as a native provider that fetches cloud models from `https://ollama.com/api/tags`, chats through `https://ollama.com/api/chat`, supports streaming, and exposes ergonomic thinking/options controls.

**Architecture:** Follow the existing NanoGPT pattern: keep one custom provider entry in the model list, fetch selectable remote models on demand, and optionally register fetched models into `LLMModels` dynamically. Add an Ollama Cloud request module that owns authentication, model listing, NDJSON streaming parsing, `think` mapping, and `options` construction while leaving the existing local `ollama-hosted` path intact.

**Tech Stack:** TypeScript, Svelte 5, Vitest, pnpm, Ollama Cloud API

---

### Task 1: Model and database shape

**Files:**
- Modify: `src/ts/model/types.ts`
- Modify: `src/ts/model/modellist.ts`
- Modify: `src/ts/storage/database.svelte.ts`
- Test: `src/ts/model/modellistDynamic.test.ts`

**Step 1: Write the failing test**

Add a dynamic registration test beside the NanoGPT test:

```ts
it('registers Ollama Cloud models dynamically', async () => {
    mocks.fetchOllamaCloudModels.mockResolvedValue({
        models: [
            {
                id: 'gpt-oss:120b',
                name: 'gpt-oss:120b',
                family: 'gpt-oss',
                parameterSize: '120B',
                quantizationLevel: '',
                capabilities: ['completion'],
            },
        ],
    })

    const { LLMProvider, LLMModels, registerOllamaCloudModelsDynamic } = await import('./modellist')

    await registerOllamaCloudModelsDynamic()

    const syncedModel = LLMModels.find((model) => model.id === 'dynamic_ollama_cloud_gpt-oss:120b')
    expect(syncedModel?.provider).toBe(LLMProvider.OllamaCloud)
    expect(syncedModel?.internalID).toBe('gpt-oss:120b')
})
```

Mock `../process/request/ollamaCloud` in the same style as the existing NanoGPT mock.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/ts/model/modellistDynamic.test.ts`
Expected: FAIL because `LLMProvider.OllamaCloud`, `registerOllamaCloudModelsDynamic`, and `fetchOllamaCloudModels` do not exist.

**Step 3: Add provider/model fields**

- Add `OllamaCloud` to `LLMProvider`.
- Add provider display name `Ollama Cloud`.
- Add a single provider entry:

```ts
{
    id: 'ollama-cloud',
    name: 'Ollama Cloud (Custom)',
    fullName: 'Ollama Cloud (Custom)',
    provider: LLMProvider.OllamaCloud,
    format: LLMFormat.Ollama,
    flags: [LLMFlags.hasFullSystemPrompt, LLMFlags.hasStreaming],
    parameters: ['temperature', 'top_p', 'top_k', 'repetition_penalty'],
    tokenizer: LLMTokenizer.Unknown,
    recommended: true,
}
```

- Add database fields and defaults:

```ts
ollamaCloudKey: string
ollamaCloudModel: string
ollamaCloudModelName: string
ollamaCloudThink: 'auto' | 'off' | 'on' | 'low' | 'medium' | 'high'
ollamaCloudOptionsJson: string
```

Defaults:

```ts
data.ollamaCloudKey ??= ''
data.ollamaCloudModel ??= ''
data.ollamaCloudModelName ??= ''
data.ollamaCloudThink ??= 'auto'
data.ollamaCloudOptionsJson ??= ''
```

**Step 4: Add dynamic model registration**

In `src/ts/model/modellist.ts`, add `registerOllamaCloudModelsDynamic()`:

- Return early when `DBState.db.ollamaCloudKey` is missing.
- Import `fetchOllamaCloudModels`.
- Push models with `id: dynamic_ollama_cloud_${model.id}`.
- Set `internalID` to the Ollama model id.
- Add `LLMFlags.hasImageInput` when capabilities include `vision`.
- Use `LLMTokenizer.Llama` for llama-like families and `Unknown` otherwise.

**Step 5: Run test to verify it passes**

Run: `pnpm test src/ts/model/modellistDynamic.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/ts/model/types.ts src/ts/model/modellist.ts src/ts/storage/database.svelte.ts src/ts/model/modellistDynamic.test.ts
git commit -m "feat: register ollama cloud provider"
```

### Task 2: Ollama Cloud request module

**Files:**
- Create: `src/ts/process/request/ollamaCloud.ts`
- Modify: `src/ts/process/request/request.ts`
- Test: `src/ts/process/request/request.test.ts`

**Step 1: Write routing and payload tests**

Add tests covering:

- A model with `provider === LLMProvider.OllamaCloud` routes to `requestOllamaCloud`.
- `resolveOllamaThinkMode('auto')` omits `think`.
- `resolveOllamaThinkMode('on')` returns `true`.
- `resolveOllamaThinkMode('high')` returns `'high'`.
- Invalid `ollamaCloudOptionsJson` returns a fail response before making a request.

**Step 2: Run test to verify it fails**

Run: `pnpm test src/ts/process/request/request.test.ts`
Expected: FAIL because `ollamaCloud.ts` and provider routing are missing.

**Step 3: Implement model listing helpers**

Create `src/ts/process/request/ollamaCloud.ts` with:

```ts
export type OllamaCloudThinkMode = 'auto' | 'off' | 'on' | 'low' | 'medium' | 'high'

export type OllamaCloudModelInfo = {
    id: string
    name: string
    family: string
    parameterSize: string
    quantizationLevel: string
    capabilities: string[]
}
```

Add `fetchOllamaCloudModels(apiKey = getDatabase().ollamaCloudKey)`:

- `GET https://ollama.com/api/tags`
- Header `Authorization: Bearer ${apiKey}`
- Map `models[]` to `OllamaCloudModelInfo`.
- For each model, optionally call `/api/show` with `{ model }` to enrich `capabilities`; if that fails, keep an empty array.
- Return `{ models, error? }` instead of throwing.

**Step 4: Implement request builder**

Add:

```ts
export function resolveOllamaThinkMode(mode: OllamaCloudThinkMode): boolean | 'low' | 'medium' | 'high' | undefined {
    if (mode === 'auto') return undefined
    if (mode === 'off') return false
    if (mode === 'on') return true
    return mode
}
```

Build chat body:

- `model`: `arg.modelInfo.internalID` for dynamic models, otherwise `db.ollamaCloudModel`.
- `messages`: role/content pairs for `system`, `user`, `assistant`.
- `stream`: `arg.useStreaming`.
- `think`: only when `resolveOllamaThinkMode()` is not `undefined`.
- `options`: merge parsed `db.ollamaCloudOptionsJson` with UI parameters; UI parameters win.

Map UI parameters:

- `temperature`
- `top_p`
- `top_k`
- `repeat_penalty` from current `repetition_penalty`
- `num_predict` from `arg.maxTokens` when available

**Step 5: Implement response handling**

Use `fetchNative` or the project’s existing `globalFetch` pattern with:

- URL `https://ollama.com/api/chat`
- Header `Authorization: Bearer ${db.ollamaCloudKey}`
- Header `Content-Type: application/json`

For streaming:

- Parse `application/x-ndjson`.
- Emit `chunk.message.content` into the existing `StreamResponseChunk`.
- If `chunk.message.thinking` exists, preserve it in the stream shape if an existing thinking channel exists; otherwise prefix it into a separate accumulated internal field and do not mix it into normal content.
- Close on `done: true`.

For non-streaming:

- Return `response.message.content`.
- If `response.message.thinking` exists and the app has an established thinking display field, attach it there; otherwise ignore it for visible content in this first pass.

Error handling:

- Missing API key: fail with `Ollama Cloud API key is required.`
- Missing selected model: fail with `Select an Ollama Cloud model first.`
- Invalid options JSON: fail with `Ollama Cloud options JSON is invalid.`
- Thinking level rejected by API: fail with `This model may only support Think On/Off. Use On instead of Low/Medium/High.`

**Step 6: Route provider before format switch**

In `requestChatDataMain`, add:

```ts
if (targ.modelInfo.provider === LLMProvider.OllamaCloud) {
    return requestOllamaCloud(targ)
}
```

Place it beside the existing Copilot and NanoGPT provider routing.

**Step 7: Run tests**

Run: `pnpm test src/ts/process/request/request.test.ts`
Expected: PASS.

**Step 8: Commit**

```bash
git add src/ts/process/request/ollamaCloud.ts src/ts/process/request/request.ts src/ts/process/request/request.test.ts
git commit -m "feat: add ollama cloud chat requests"
```

### Task 3: Settings UI

**Files:**
- Modify: `src/lib/Setting/Pages/BotSettings.svelte`
- Modify: `src/ts/model/ollamaCloud.ts`
- Test: type check through `pnpm check`

**Step 1: Create model-grid helpers**

Create `src/ts/model/ollamaCloud.ts` with:

- Re-export or wrap `fetchOllamaCloudModels`.
- `toModelGridItem(model)` returning:
  - `id`
  - `displayName`
  - `providerName`: family or `Ollama`
  - `description`: parameter size, quantization, capabilities
  - `context_length` if available from `/api/show` metadata in a later pass

**Step 2: Add UI state and sync action**

In `BotSettings.svelte`:

- Import `getOllamaCloudModels`, `ocToGridItem`, and `registerOllamaCloudModelsDynamic`.
- Add state:

```ts
let ollamaCloudModelSyncStatus: 'idle'|'loading'|'done'|'error' = $state('idle')
let ollamaCloudModelSyncCount = $state(0)
let ollamaCloudInputMode = $state<'list' | 'manual'>('list')
```

- Add `syncOllamaCloudModels()` matching the NanoGPT/Copilot sync pattern.

**Step 3: Add provider settings block**

Render when:

```svelte
{#if modelInfo.provider === LLMProvider.OllamaCloud || subModelInfo.provider === LLMProvider.OllamaCloud}
```

Fields:

- API Key text input.
- `SegmentedControl` for `List` / `Manual`.
- In list mode, use `ModelGrid` backed by `getOllamaCloudModels(DBState.db.ollamaCloudKey)`.
- In manual mode, text input bound to `DBState.db.ollamaCloudModel`.
- Think segmented control: `Auto`, `Off`, `On`, `Low`, `Medium`, `High`.
- Advanced accordion with `ollamaCloudOptionsJson` textarea.
- `Sync Models` button with success/error state.

**Step 4: Keep the UI copy compact**

Use labels only:

- `Ollama Cloud API Key`
- `Model`
- `Think`
- `Advanced Options JSON`

Put the explanation in a tooltip:

`Auto lets Ollama decide. Some models support only On/Off; others support Low/Medium/High.`

**Step 5: Run type check**

Run: `pnpm check`
Expected: `0 errors`.

**Step 6: Commit**

```bash
git add src/lib/Setting/Pages/BotSettings.svelte src/ts/model/ollamaCloud.ts
git commit -m "feat: add ollama cloud settings"
```

### Task 4: Integration and verification

**Files:**
- Modify: only if verification finds issues

**Step 1: Run targeted tests**

Run:

```bash
pnpm test src/ts/model/modellistDynamic.test.ts src/ts/process/request/request.test.ts
```

Expected: PASS.

**Step 2: Run full type check**

Run: `pnpm check`
Expected: `0 errors`.

**Step 3: Optional live API smoke test**

If an Ollama Cloud API key is available:

```bash
curl https://ollama.com/api/tags \
  -H "Authorization: Bearer $OLLAMA_API_KEY"
```

Expected: JSON with `models`.

Then test one non-streaming chat:

```bash
curl https://ollama.com/api/chat \
  -H "Authorization: Bearer $OLLAMA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"<model-from-tags>","messages":[{"role":"user","content":"Say hi"}],"stream":false}'
```

Expected: JSON with `message.content`.

**Step 4: Manual app smoke check**

- Select `Ollama Cloud (Custom)`.
- Enter API key.
- Confirm model grid loads from `/api/tags`.
- Select a model.
- Send a short prompt with `Think: Auto`.
- Repeat with `Think: On`.
- Try `Think: High` on a model that supports it.
- Put invalid JSON in Advanced Options and confirm the request fails locally with a clear error.

**Step 5: Commit verification fixes**

```bash
git add <changed files>
git commit -m "fix: polish ollama cloud provider integration"
```
