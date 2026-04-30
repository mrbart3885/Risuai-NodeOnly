<script lang="ts">
    // Developer-only panel. Standalone settings page (SettingsMenuIndex === 99),
    // gated by localStorage['risu-dev-panel']='1'. The menu button in
    // Settings.svelte and the route render branch are both behind the same flag.
    //
    // Each button drives the production alert* / notify* / update APIs through
    // realistic Korean copy so the migrated dialogs can be exercised
    // end-to-end (chains, loading transitions, nested overlays) without
    // leaving the settings page.
    import {
        alertError,
        alertNormal,
        alertNormalWait,
        alertMd,
        alertConfirm,
        alertInput,
        alertSelect,
        alertWait,
        alertClear,
        waitAlert,
        notifySuccess,
        notifyInfo,
        notifyError,
    } from "src/ts/alert";
    import { language } from "src/lang";
    import { alertStore } from "src/ts/stores.svelte";
    import { sleep } from "src/ts/util";
    import { resetAllPluginPermissions } from "src/ts/plugins/apiV3/v3.svelte";
    import {
        updatePopupStore,
        selfUpdateProgressStore,
        dismissUpdatePopup,
        type UpdateInfo,
        type SelfUpdateProgress,
    } from "src/ts/update";
    import ShDialog from "src/lib/UI/GUI/ShDialog.svelte";
    import ShButton from "src/lib/UI/GUI/ShButton.svelte";
    import ShBadge from "src/lib/UI/GUI/ShBadge.svelte";
    import ShAlert from "src/lib/UI/GUI/ShAlert.svelte";
    import ShInput from "src/lib/UI/GUI/ShInput.svelte";
    import ShToggle from "src/lib/UI/GUI/ShToggle.svelte";
    import ShSwitch from "src/lib/UI/GUI/ShSwitch.svelte";
    import { TriangleAlertIcon, InfoIcon, CheckCircleIcon, XCircleIcon } from "@lucide/svelte";
    import ShSelect from "src/lib/UI/GUI/ShSelect.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import ShAccordion from "src/lib/UI/GUI/ShAccordion.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";

    let lastResult = $state('');

    function disablePanel() {
        localStorage.removeItem('risu-dev-panel');
        location.reload();
    }

    function setResult(s: string) {
        lastResult = s;
    }

    // ─── Section 1: Basic alert* triggers ────────────────────────────────────

    function triggerErrorWithStack() {
        alertError(new Error('샘플 에러: 스택 트레이스 포함\n  at devPanel (DevPanel.svelte:42)'));
        setResult('alertError(new Error(...)) 실행됨');
    }

    function triggerErrorNoStack() {
        alertError('단순 에러 메시지 (스택 없음)');
        setResult('alertError("string") 실행됨');
    }

    function triggerNormal() {
        alertNormal('저장이 완료되었습니다.');
        setResult('alertNormal 실행됨');
    }

    async function triggerNormalWait() {
        await alertNormalWait('이 메시지를 닫으면 후속 작업이 진행됩니다.');
        notifyInfo('alertNormalWait 종료 → 후속 단계 실행');
        setResult('alertNormalWait 종료 후 notify 발사');
    }

    function triggerMarkdown() {
        alertMd(`# 마크다운 테스트

이것은 **굵은 글씨**, *기울임*, ~~취소선~~ 입니다.

## 코드 블록
\`\`\`typescript
function hello(): string {
    return "world";
}
\`\`\`

## 리스트
- 항목 1
- 항목 2
- 항목 3

## 인라인 코드
\`alertMd(msg)\` 는 마크다운을 파싱해서 보여줍니다.

> 인용문도 잘 렌더되는지 확인.

[링크](https://example.com)
`);
        setResult('alertMd 실행됨');
    }

    async function triggerConfirm() {
        const ok = await alertConfirm('정말 이 캐릭터를 삭제하시겠습니까?');
        setResult(`alertConfirm 결과: ${ok ? 'YES' : 'NO'}`);
        if (ok) notifySuccess('삭제 완료 (시뮬레이션)');
        else notifyInfo('취소됨');
    }

    async function triggerInputSimple() {
        const value = await alertInput('새 캐릭터 이름을 입력하세요');
        setResult(`alertInput: "${value}"`);
        notifyInfo(`입력값: "${value}"`);
    }

    async function triggerInputDatalist() {
        const value = await alertInput('MCP 모듈 URL 선택 또는 입력', [
            ['internal:aiaccess', 'LLM Call Client (internal:aiaccess)'],
            ['internal:risuai', 'Risu Access Client (internal:risuai)'],
            ['internal:fs', 'File System Client (internal:fs)'],
            ['internal:googlesearch', 'Google Search (internal:googlesearch)'],
        ]);
        setResult(`alertInput (datalist): "${value}"`);
        notifyInfo(`입력값: "${value}"`);
    }

    async function triggerInputDefault() {
        const value = await alertInput('프리셋 이름 변경', undefined, '기존 프리셋 이름');
        setResult(`alertInput (defaultValue): "${value}"`);
        notifyInfo(`입력값: "${value}"`);
    }

    async function triggerSelect() {
        const idx = await alertSelect(['옵션 A', '옵션 B', '옵션 C']);
        setResult(`alertSelect: index=${idx}`);
        notifyInfo(`선택: index=${idx}`);
    }

    async function triggerSelectDisplay() {
        const idx = await alertSelect(
            ['덮어쓰기', '새 슬롯에 저장', '취소'],
            '이 이름의 프리셋이 이미 존재합니다. 어떻게 처리할까요?'
        );
        setResult(`alertSelect (display): index=${idx}`);
        notifyInfo(`선택: index=${idx}`);
    }

    // ─── Section 2: Loading transitions ──────────────────────────────────────

    async function triggerWaitShort() {
        alertWait('잠시만 기다려주세요...');
        await sleep(2500);
        alertClear();
        notifySuccess('완료');
        setResult('alertWait 2.5초 후 자동 종료');
    }

    async function triggerWaitMultiStep() {
        alertWait('1단계: 데이터 수집 중...');
        await sleep(1000);
        alertWait('2단계: 압축 중...');
        await sleep(1000);
        alertWait('3단계: 업로드 중...');
        await sleep(1000);
        alertWait('4단계: 마무리 중...');
        await sleep(800);
        alertClear();
        notifySuccess('모든 단계 완료');
        setResult('alertWait 텍스트 갱신 (4단계)');
    }

    async function triggerWaitThenError() {
        alertWait('이미지 생성 중...');
        await sleep(1500);
        alertError('이미지 생성 실패: API 응답 시간 초과');
        await waitAlert();
        notifyInfo('에러 모달 닫힌 후 후속 동작');
        setResult('alertWait → alertError 덮어쓰기 시퀀스 종료');
    }

    async function triggerProgressBar() {
        for (let i = 0; i <= 100; i += 5) {
            alertStore.set({ type: 'progress', msg: '대용량 업로드 진행 중', submsg: i.toString() });
            await sleep(80);
        }
        alertClear();
        notifySuccess('업로드 완료');
        setResult('progress 0→100% 시뮬레이션 종료');
    }

    // ─── Section 3: Chained sequences (real patterns) ────────────────────────

    async function simulateBackupRestoreSuccess() {
        // Mirrors serverBackupManager.svelte:39-61 happy path:
        // alertConfirm × 2 → alertWait → progress updates → success
        if (!(await alertConfirm('정말로 이 백업을 복원하시겠습니까?\n현재 데이터가 모두 덮어써집니다.'))) {
            notifyInfo('1단계 취소');
            setResult('백업 복원 1단계 취소');
            return;
        }
        if (!(await alertConfirm('확실합니까? 이 작업은 되돌릴 수 없습니다.'))) {
            notifyInfo('2단계 취소');
            setResult('백업 복원 2단계 취소');
            return;
        }
        alertWait('백업 복원 중...');
        await sleep(800);
        for (let p = 20; p <= 100; p += 20) {
            alertWait(`백업 복원 중... (${p}%)`);
            await sleep(500);
        }
        alertClear();
        notifySuccess('복원 완료. (실제로는 페이지 리로드)');
        setResult('백업 복원 풀 시퀀스 성공 종료');
    }

    async function simulateBackupRestorePartialFail() {
        // Mirrors serverBackupManager.svelte:50-52 partial-fail path:
        // alertConfirm → alertWait → alertError → waitAlert → notifyInfo
        if (!(await alertConfirm('백업을 복원하시겠습니까?'))) return;
        alertWait('백업 복원 중...');
        await sleep(1200);
        alertError('경고: 일부 캐릭터(3개)를 cold storage에서 복원하지 못했습니다. 복원된 데이터가 불완전할 수 있습니다.');
        await waitAlert();
        notifyInfo('사용자 확인 완료 → 페이지 리로드 단계로 진행');
        setResult('백업 복원 부분 실패 시퀀스 종료');
    }

    async function simulatePluginPermissionFlow() {
        // Mirrors apiV3/v3.svelte.ts:602-612 — real plugin permission consent
        // path uses alertConfirm() with language.xxxConsent strings, not the
        // (unused) alertPluginConfirm. Cycles through several permission types
        // so all consent translations get exercised.
        const requests: { label: string; key: keyof typeof language }[] = [
            { label: 'DB 접근', key: 'getFullDatabaseConsent' },
            { label: '메인 Document 접근', key: 'mainDomAccessConsent' },
            { label: '채팅 메시지 전송', key: 'sendChatConsent' },
        ];
        const pluginName = 'sample-plugin';
        for (const req of requests) {
            const template = language[req.key] as string;
            const ok = await alertConfirm(template.replace('{}', pluginName));
            if (!ok) {
                notifyInfo(`"${req.label}" 권한 거부`);
                setResult(`플러그인 권한 흐름 중단: ${req.label} 거부`);
                return;
            }
            notifySuccess(`"${req.label}" 권한 허용`);
        }
        setResult('플러그인 권한 흐름 모두 허용');
    }

    async function simulateCharacterCreate() {
        // input → wait → success
        const name = await alertInput('새 캐릭터 이름을 입력하세요');
        if (!name) {
            notifyInfo('이름이 비어 캐릭터 생성 취소');
            setResult('캐릭터 생성 취소');
            return;
        }
        alertWait(`"${name}" 캐릭터 생성 중...`);
        await sleep(1200);
        alertClear();
        notifySuccess(`캐릭터 "${name}" 생성 완료`);
        setResult(`캐릭터 "${name}" 생성 시퀀스 종료`);
    }

    async function simulateImageGeneration() {
        // alertWait → notifyError on fail (no waitAlert blocking)
        alertWait('이미지 생성 중... (예상 30초)');
        await sleep(2000);
        alertClear();
        notifyError('이미지 생성 실패: 네트워크 오류');
        setResult('이미지 생성 시퀀스 종료 (notify 경로)');
    }

    // ─── Section 4: Nested overlay (custom modal + alertConfirm) ────────────

    let nestedDialogOpen = $state(false);
    let nestedItems = $state(['프리셋 A', '프리셋 B', '프리셋 C']);

    async function deleteNestedItem(idx: number) {
        const name = nestedItems[idx];
        // ShDialog parent stays open during alertConfirm child overlay.
        const ok = await alertConfirm(`"${name}"을 삭제하시겠습니까?`);
        if (ok) {
            nestedItems = nestedItems.filter((_, i) => i !== idx);
            notifySuccess(`"${name}" 삭제됨`);
            setResult(`중첩: "${name}" 삭제 후 ShDialog 유지`);
        } else {
            notifyInfo('삭제 취소');
            setResult('중첩: 삭제 취소, ShDialog 유지');
        }
    }

    async function renameNestedItem(idx: number) {
        const oldName = nestedItems[idx];
        const newName = await alertInput('새 이름을 입력하세요', undefined, oldName);
        if (newName && newName !== oldName) {
            nestedItems[idx] = newName;
            notifySuccess(`"${oldName}" → "${newName}"`);
            setResult(`중첩: 이름 변경 후 ShDialog 유지`);
        } else {
            setResult('중첩: 이름 변경 없음');
        }
    }

    // ─── Section 5: Reset utilities ──────────────────────────────────────────

    // ─── Section 6: UpdatePopup simulation ───────────────────────────────────
    // Drives updatePopupStore + selfUpdateProgressStore directly so the real
    // <UpdatePopup /> mounted in App.svelte renders. dismissUpdatePopup()
    // does NOT touch the per-version dismissed key (only showUpdatePopupOnce
    // does), so triggering demos here is safe — real updates are not lost.
    const SAMPLE_UPDATE_BASE: UpdateInfo = {
        currentVersion: '1.3.0',
        latestVersion: '99.99.99-demo',
        hasUpdate: true,
        severity: 'optional',
        releaseUrl: 'https://github.com/mrbart3885/Risuai-NodeOnly/releases',
        releaseName: 'v99.99.99-demo (Dev Panel sample)',
        publishedAt: new Date().toISOString(),
        canSelfUpdate: true,
        deploymentType: 'portable',
    };
    const SAMPLE_POPUP_MESSAGE = '- 채팅 로딩 속도 개선\n- 백업 안정성 향상\n- shadcn 기반 다이얼로그 도입';

    function showUpdate(overrides: Partial<UpdateInfo> = {}) {
        selfUpdateProgressStore.set(null);
        updatePopupStore.set({ ...SAMPLE_UPDATE_BASE, ...overrides });
    }

    function showProgress(progress: SelfUpdateProgress, infoOverrides: Partial<UpdateInfo> = {}) {
        updatePopupStore.set({ ...SAMPLE_UPDATE_BASE, ...infoOverrides });
        selfUpdateProgressStore.set(progress);
    }

    function forceCloseUpdate() {
        selfUpdateProgressStore.set(null);
        dismissUpdatePopup();
        setResult('UpdatePopup: 강제 닫힘');
    }

    // ─── Section 7: Component gallery ────────────────────────────────────────
    // Live preview of the Sh* components in their current vega-derived spec.
    // Buttons are no-ops; widgets bind to local state for interaction feel.

    let galleryToggle1 = $state(false);
    let galleryToggle2 = $state(true);
    let galleryToggle3 = $state(false);
    let gallerySwitch1 = $state(false);
    let gallerySwitch2 = $state(true);
    let gallerySwitch3 = $state(false);
    let gallerySwitch4 = $state(true);
    let galleryInputText = $state('');
    let gallerySelectValue = $state('option-2');
    // 긴 옵션 리스트 — 키보드 nav 스크롤-인-뷰 + 초기 열림 시 스크롤 점프 검증용.
    // 기본값을 중간에 두어, 처음 열 때 드롭다운이 그 위치로 점프하는지 확인 가능.
    const galleryLongOptions = Array.from({ length: 50 }, (_, i) => `item-${String(i + 1).padStart(2, '0')}`);
    let galleryLongSelectValue = $state('item-25');

    async function resetPluginPermissions() {
        const ok = await alertConfirm(
            '모든 플러그인의 저장된 권한 응답(허용/거부 이력 + 캐시)을 삭제하시겠습니까?\n\n다음에 플러그인이 권한을 요청할 때 다시 묻습니다.'
        );
        if (!ok) {
            setResult('플러그인 권한 리셋 취소');
            return;
        }
        try {
            await resetAllPluginPermissions();
            notifySuccess('플러그인 권한 리셋 완료');
            setResult('플러그인 권한 in-memory + persistent 모두 클리어');
        } catch (err) {
            notifyError(err instanceof Error ? err.message : String(err));
            setResult('플러그인 권한 리셋 실패');
        }
    }
</script>

<div class="flex flex-col gap-3">
    <div class="flex items-center justify-between flex-wrap gap-2">
        <h2 class="text-lg font-semibold text-textcolor">Dev Panel</h2>
        <ShButton variant="ghost" size="sm" onclick={disablePanel}>
            Disable panel
        </ShButton>
    </div>
    <p class="text-xs text-textcolor2">
        Toggled via <code class="bg-bgcolor px-1 py-0.5 rounded">localStorage['risu-dev-panel']='1'</code>.
        각 버튼은 실제 alert* / notify* 호출을 발생시켜 마이그레이션된 다이얼로그를 end-to-end로 검증합니다.
    </p>

    <!-- Section 1 -->
    <div class="mt-2 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">1. 기본 alert*</h3>
        <div class="flex flex-wrap gap-2">
            <ShButton variant="destructive" onclick={triggerErrorWithStack}>alertError (스택 있음)</ShButton>
            <ShButton variant="destructive" onclick={triggerErrorNoStack}>alertError (스택 없음)</ShButton>
            <ShButton onclick={triggerNormal}>alertNormal</ShButton>
            <ShButton onclick={triggerNormalWait}>alertNormalWait → notify</ShButton>
            <ShButton variant="secondary" onclick={triggerMarkdown}>alertMd (markdown)</ShButton>
            <ShButton variant="outline" onclick={triggerConfirm}>alertConfirm</ShButton>
            <ShButton variant="outline" onclick={triggerInputSimple}>alertInput (단순)</ShButton>
            <ShButton variant="outline" onclick={triggerInputDatalist}>alertInput (datalist)</ShButton>
            <ShButton variant="outline" onclick={triggerInputDefault}>alertInput (defaultValue)</ShButton>
            <ShButton variant="outline" onclick={triggerSelect}>alertSelect</ShButton>
            <ShButton variant="outline" onclick={triggerSelectDisplay}>alertSelect (with prompt)</ShButton>
        </div>
    </div>

    <!-- Section 2 -->
    <div class="mt-4 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">2. 로딩 / 진행 전환</h3>
        <p class="text-xs text-textcolor2">
            alertWait 메시지 갱신, alertWait → alertError 덮어쓰기, progress 0→100% 등 ShLoadingDialog 동작을 확인합니다.
        </p>
        <div class="flex flex-wrap gap-2">
            <ShButton variant="ghost" onclick={triggerWaitShort}>alertWait (2.5초)</ShButton>
            <ShButton variant="ghost" onclick={triggerWaitMultiStep}>alertWait (4단계 갱신)</ShButton>
            <ShButton variant="ghost" onclick={triggerWaitThenError}>alertWait → alertError</ShButton>
            <ShButton variant="ghost" onclick={triggerProgressBar}>progress 0→100%</ShButton>
        </div>
    </div>

    <!-- Section 3 -->
    <div class="mt-4 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">3. 실제 시퀀스 시뮬레이션</h3>
        <p class="text-xs text-textcolor2">
            serverBackupManager 등 프로덕션 호출처의 흐름을 그대로 재현합니다.
        </p>
        <div class="flex flex-wrap gap-2">
            <ShButton onclick={simulateBackupRestoreSuccess}>백업 복원 (성공)</ShButton>
            <ShButton onclick={simulateBackupRestorePartialFail}>백업 복원 (부분 실패)</ShButton>
            <ShButton onclick={simulatePluginPermissionFlow}>플러그인 권한 흐름 (3종 연속)</ShButton>
            <ShButton onclick={simulateCharacterCreate}>캐릭터 생성 흐름</ShButton>
            <ShButton onclick={simulateImageGeneration}>이미지 생성 (실패)</ShButton>
        </div>
    </div>

    <!-- Section 4 -->
    <div class="mt-4 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">4. 중첩 오버레이</h3>
        <p class="text-xs text-textcolor2">
            ShDialog (자체 state) 위에 alertConfirm / alertInput (alertStore 기반)을 띄워 togglePresets 류의 중첩 패턴을 검증합니다.
            자식 모달이 닫혀도 부모 ShDialog가 유지되어야 합니다.
        </p>
        <div class="flex flex-wrap gap-2">
            <ShButton onclick={() => { nestedDialogOpen = true }}>중첩 모달 열기</ShButton>
        </div>
    </div>

    <!-- Section 5 -->
    <div class="mt-4 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">5. 리셋 유틸리티</h3>
        <p class="text-xs text-textcolor2">
            테스트 중 누적된 상태를 초기화합니다.
        </p>
        <div class="flex flex-wrap gap-2">
            <ShButton variant="destructive" onclick={resetPluginPermissions}>플러그인 권한 리셋</ShButton>
        </div>
    </div>

    <!-- Section 6 -->
    <div class="mt-4 flex flex-col gap-2">
        <h3 class="text-sm font-semibold text-textcolor">6. UpdatePopup 시뮬레이션</h3>
        <p class="text-xs text-textcolor2">
            실제 <code class="bg-bgcolor px-1 py-0.5 rounded">&lt;UpdatePopup /&gt;</code>
            (App.svelte에 항상 마운트)을 직접 띄웁니다. <strong class="text-textcolor">"Reload" 버튼은 진짜 페이지 reload</strong>를
            일으키니 데모 중에는 누르지 마세요. 끝나면 "강제 닫기"로 정리.
        </p>

        <div class="mt-1 flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">Idle 상태</span>
            <div class="flex flex-wrap gap-2">
                <ShButton size="sm" onclick={() => showUpdate()}>Optional + Self-update</ShButton>
                <ShButton size="sm" onclick={() => showUpdate({ severity: 'required' })}>Required + Self-update</ShButton>
                <ShButton size="sm" onclick={() => showUpdate({ canSelfUpdate: false })}>Optional + View Release only</ShButton>
                <ShButton size="sm" onclick={() => showUpdate({ severity: 'required', canSelfUpdate: false })}>Required + View Release only</ShButton>
                <ShButton size="sm" onclick={() => showUpdate({ popupMessage: SAMPLE_POPUP_MESSAGE })}>+ popupMessage</ShButton>
            </div>
        </div>

        <div class="mt-1 flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">진행 단계 (X 숨김 / 블로킹)</span>
            <div class="flex flex-wrap gap-2">
                <ShButton size="sm" onclick={() => showProgress({ step: 'checking', progress: 0, message: '업데이트 정보 확인 중...' })}>checking</ShButton>
                <ShButton size="sm" onclick={() => showProgress({ step: 'downloading', progress: 50, message: 'v99.99.99-demo 다운로드 중... (3.2 MB / 6.4 MB)' })}>downloading 50%</ShButton>
                <ShButton size="sm" onclick={() => showProgress({ step: 'extracting', progress: null, message: '아카이브 추출 중...' })}>extracting</ShButton>
                <ShButton size="sm" onclick={() => showProgress({ step: 'replacing', progress: null, message: '실행 파일 교체 중...' })}>replacing</ShButton>
                <ShButton size="sm" onclick={() => showProgress({ step: 'restarting', progress: null, message: '서버 재시작 대기 중...' })}>restarting</ShButton>
            </div>
        </div>

        <div class="mt-1 flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">종료 단계 (X 노출 / 닫기 가능)</span>
            <div class="flex flex-wrap gap-2">
                <ShButton size="sm" variant="success" onclick={() => showProgress({ step: 'done', progress: 100, message: '업데이트 완료.' })}>done (Reload 주의)</ShButton>
                <ShButton size="sm" variant="destructive" onclick={() => showProgress({ step: 'error', progress: null, message: '업데이트 실패: 서버 응답 없음 (HTTP 502)' })}>error</ShButton>
                <ShButton size="sm" variant="ghost" onclick={forceCloseUpdate}>강제 닫기</ShButton>
            </div>
        </div>
    </div>

    <!-- Section 7 -->
    <div class="mt-4 flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-textcolor">7. 컴포넌트 갤러리</h3>
        <p class="text-xs text-textcolor2">
            vega-derived h-10 spec 시각 검증용. 같은 행에 놓인 컴포넌트들이 정렬되어야 함.
        </p>

        <!-- ShButton variants × default size -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShButton variants (default size, h-10)</span>
            <div class="flex flex-wrap gap-2 items-center">
                <ShButton variant="default">Default</ShButton>
                <ShButton variant="outline">Outline</ShButton>
                <ShButton variant="secondary">Secondary</ShButton>
                <ShButton variant="ghost">Ghost</ShButton>
                <ShButton variant="primary">Primary</ShButton>
                <ShButton variant="destructive">Destructive</ShButton>
                <ShButton variant="success">Success</ShButton>
                <ShButton variant="link">Link</ShButton>
            </div>
            <p class="text-xs text-textcolor2/60 mt-1">
                Primary는 filled-solid 톤(테마별 동적 액센트). destructive/success의 muted 톤과는 의도적으로 차별화 — ShSwitch 트랙과 같은 풀 fill 강도를 공유합니다.
            </p>
        </div>

        <!-- ShButton sizes -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShButton sizes (xs h-7 / sm h-8 / default h-10 / lg h-11)</span>
            <div class="flex flex-wrap gap-2 items-center">
                <ShButton size="xs">xs</ShButton>
                <ShButton size="sm">sm</ShButton>
                <ShButton size="default">default</ShButton>
                <ShButton size="lg">lg</ShButton>
            </div>
        </div>

        <!-- ShToggle -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShToggle (default h-10)</span>
            <div class="flex flex-wrap gap-2 items-center">
                <ShToggle bind:pressed={galleryToggle1}>Toggle</ShToggle>
                <ShToggle bind:pressed={galleryToggle2} variant="default">Default variant</ShToggle>
                <ShToggle bind:pressed={galleryToggle3} size="sm">sm</ShToggle>
            </div>
        </div>

        <!-- ShSwitch -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShSwitch (checked → bg-primary)</span>
            <div class="flex flex-wrap gap-4 items-center">
                <label class="flex items-center gap-2 cursor-pointer select-none text-textcolor">
                    <ShSwitch bind:checked={gallerySwitch1} />
                    off → on
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none text-textcolor">
                    <ShSwitch bind:checked={gallerySwitch2} />
                    on (default)
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none text-textcolor">
                    <ShSwitch bind:checked={gallerySwitch3} size="sm" />
                    sm size
                </label>
                <label class="flex items-center gap-2 cursor-pointer select-none text-textcolor2">
                    <ShSwitch bind:checked={gallerySwitch4} disabled />
                    disabled (on)
                </label>
            </div>
            <p class="text-xs text-textcolor2/60 mt-1">
                checked 트랙은 ColorScheme.primary 색을 따릅니다 — 테마를 바꾸면 색도 바뀜.
            </p>
        </div>

        <!-- ShBadge -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShBadge variants</span>
            <div class="flex flex-wrap gap-2 items-center">
                <ShBadge>default</ShBadge>
                <ShBadge variant="secondary">secondary</ShBadge>
                <ShBadge variant="destructive">destructive</ShBadge>
                <ShBadge variant="outline">outline</ShBadge>
                <ShBadge variant="ghost">ghost</ShBadge>
                <ShBadge variant="warning">warning</ShBadge>
                <ShBadge variant="info">info</ShBadge>
                <ShBadge variant="success">success</ShBadge>
            </div>
        </div>

        <!-- ShAlert -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">ShAlert variants (icon + body)</span>
            <div class="flex flex-col gap-2 max-w-md">
                <ShAlert variant="default">
                    {#snippet icon()}<InfoIcon />{/snippet}
                    {#snippet title()}안내{/snippet}
                    중성 톤의 기본 알림. 추가 컨텍스트가 필요할 때 사용합니다.
                </ShAlert>
                <ShAlert variant="info">
                    {#snippet icon()}<InfoIcon />{/snippet}
                    파란 톤 정보 안내. 일반적인 도움말/팁 전달용.
                </ShAlert>
                <ShAlert variant="success">
                    {#snippet icon()}<CheckCircleIcon />{/snippet}
                    {#snippet title()}완료{/snippet}
                    초록 톤. 작업 성공 알림에 사용합니다.
                </ShAlert>
                <ShAlert variant="warning">
                    {#snippet icon()}<TriangleAlertIcon />{/snippet}
                    노랑 톤. 주의 환기가 필요한 상황에 사용합니다.
                </ShAlert>
                <ShAlert variant="destructive">
                    {#snippet icon()}<XCircleIcon />{/snippet}
                    {#snippet title()}위험{/snippet}
                    빨강(draculared) 톤. 보안/데이터 위험 경고용.
                </ShAlert>
                <ShAlert variant="info">
                    아이콘 없는 형태. 단순 정보 박스로 사용 가능.
                </ShAlert>
            </div>
        </div>

        <!-- ShInput / ShSelect / ShButton 정렬 검증 -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">폼 정렬 (ShInput + ShSelect + ShButton 모두 h-10)</span>
            <div class="flex flex-wrap gap-2 items-end">
                <ShInput bind:value={galleryInputText} placeholder="ShInput (text-base 16px)" className="max-w-xs" />
                <ShSelect bind:value={gallerySelectValue} className="max-w-xs">
                    <OptionInput value="option-1">옵션 1</OptionInput>
                    <OptionInput value="option-2">옵션 2 (선택됨)</OptionInput>
                    <OptionInput value="option-3">옵션 3</OptionInput>
                </ShSelect>
                <ShButton>제출</ShButton>
            </div>
            <p class="text-xs text-textcolor2/60 mt-1">
                세 컨트롤의 위·아래 라인이 픽셀 단위로 맞아야 합니다.
            </p>
        </div>

        <!-- ShSelect 긴 리스트 — 스크롤-인-뷰 + 초기 열림 점프 검증 -->
        <div class="flex flex-col gap-1.5">
            <span class="text-xs text-textcolor2">긴 ShSelect (50개) — 키보드 nav 스크롤 검증</span>
            <ShSelect bind:value={galleryLongSelectValue} className="max-w-xs">
                {#each galleryLongOptions as opt}
                    <OptionInput value={opt}>{opt}</OptionInput>
                {/each}
            </ShSelect>
            <ul class="text-xs text-textcolor2/60 mt-1 list-disc pl-4 space-y-0.5">
                <li>처음 열기: 기본값이 <code>item-25</code>이라 드롭다운이 그 위치로 스크롤되어 열려야 함</li>
                <li>↓↓↓ 연타: 하이라이트가 항상 화면 안에 있어야 함 (block: nearest)</li>
                <li>↑↑↑ 위로 올라갈 때도 동일</li>
                <li>현재 선택값: <code>{galleryLongSelectValue}</code></li>
            </ul>
        </div>
    </div>

    <!-- Section 8 -->
    <div class="mt-4 flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-textcolor">8. ShAccordion 변형 비교</h3>
        <p class="text-xs text-textcolor2">
            <code>card</code> / <code>plain</code> / <code>indent</code> 세 변형. 좌측은 사이드바 폭(280px) 제약, 우측은 풀폭. 펼친 상태에서 좌우 패딩·보더 손실을 비교하세요.
        </p>

        {#snippet sampleBody()}
            <div class="text-textcolor2 text-sm">샘플 본문 — 폭 비교용</div>
            <TextInput value="Field A" />
            <TextInput value="Field B" />
        {/snippet}

        <div class="grid grid-cols-2 gap-4">
            <!-- 사이드바 폭 (280px) -->
            <div class="flex flex-col gap-3">
                <span class="text-xs text-textcolor2">사이드바 폭 (max-w-[280px])</span>
                <div class="max-w-[280px] flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">card</div>
                        <ShAccordion name="Sample" variant="card">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">plain</div>
                        <ShAccordion name="Sample" variant="plain">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">indent</div>
                        <ShAccordion name="Sample" variant="indent">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                </div>
            </div>

            <!-- 풀폭 -->
            <div class="flex flex-col gap-3">
                <span class="text-xs text-textcolor2">풀폭</span>
                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">card</div>
                        <ShAccordion name="Sample" variant="card">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">plain</div>
                        <ShAccordion name="Sample" variant="plain">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                    <div class="flex flex-col gap-1">
                        <div class="text-xs text-textcolor2/70">indent</div>
                        <ShAccordion name="Sample" variant="indent">
                            {@render sampleBody()}
                        </ShAccordion>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {#if lastResult}
        <div class="mt-3 p-3 bg-bgcolor border border-darkborderc rounded-md text-sm text-textcolor font-mono break-all">
            last result: {lastResult}
        </div>
    {/if}
</div>

<ShDialog bind:open={nestedDialogOpen} size="lg">
    {#snippet title()}프리셋 관리 (중첩 테스트){/snippet}
    {#snippet description()}
        각 프리셋의 작업 버튼을 클릭하면 alertConfirm / alertInput이 위에 뜨고, 닫히면 이 모달은 그대로 유지되어야 합니다.
    {/snippet}

    <div class="flex flex-col gap-2">
        {#each nestedItems as item, i}
            <div class="flex items-center gap-2 p-2 border border-darkborderc rounded-md">
                <span class="flex-1 text-textcolor">{item}</span>
                <ShButton variant="outline" size="sm" onclick={() => renameNestedItem(i)}>이름 변경</ShButton>
                <ShButton variant="destructive" size="sm" onclick={() => deleteNestedItem(i)}>삭제</ShButton>
            </div>
        {/each}
        {#if nestedItems.length === 0}
            <p class="text-textcolor2 text-sm">모두 삭제됨. (모달 닫고 다시 열면 초기화)</p>
        {/if}
    </div>

    {#snippet footer()}
        <ShButton variant="outline" onclick={() => {
            nestedItems = ['프리셋 A', '프리셋 B', '프리셋 C'];
            setResult('중첩: 항목 초기화');
        }}>초기화</ShButton>
        <ShButton onclick={() => { nestedDialogOpen = false }}>닫기</ShButton>
    {/snippet}
</ShDialog>
