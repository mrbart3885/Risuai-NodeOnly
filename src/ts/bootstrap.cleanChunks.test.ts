import { beforeEach, describe, expect, test, vi } from 'vitest'

type MockStore<T> = {
    set: (value: T) => void
    subscribe: (run: (value: T) => void) => () => void
}

function createMockStore<T>(initialValue: T): MockStore<T> {
    let value = initialValue
    return {
        set(nextValue: T) {
            value = nextValue
        },
        subscribe(run: (currentValue: T) => void) {
            run(value)
            return () => {}
        },
    }
}

const {
    dbHolder,
    storageMocks,
    getUncleanablesMock,
    loadedStore,
    selectedCharID,
    DBState,
    getDatabaseMock,
    setDatabaseMock,
} = vi.hoisted(() => {
    const initialDb = () => ({
        characters: [],
        modules: [],
        personas: [],
        botPresets: [],
        loadouts: [],
        plugins: [],
        pluginCustomStorage: {},
        didFirstSetup: false,
        botSettingAtStart: false,
        betaMobileGUI: false,
        formatversion: 5,
        language: 'en',
        characterOrder: [],
    })

    const dbHolder = {
        current: initialDb(),
        reset() {
            this.current = initialDb()
        },
    }

    const DBState = {
        db: dbHolder.current,
    }

    const storageMocks = {
        Init: vi.fn(async () => {}),
        getItem: vi.fn(async () => new Uint8Array([1])),
        setItem: vi.fn(async () => null),
        keys: vi.fn(async () => ['assets/new-bot.png']),
        removeItem: vi.fn(async () => {}),
    }

    const getUncleanablesMock = vi.fn(() => [] as string[])
    const loadedStore = createMockStore(false)
    const selectedCharID = createMockStore(0)
    const setDatabaseMock = vi.fn((db: typeof dbHolder.current) => {
        dbHolder.current = db
        DBState.db = db
    })
    const getDatabaseMock = vi.fn(() => dbHolder.current)

    return {
        dbHolder,
        storageMocks,
        getUncleanablesMock,
        loadedStore,
        selectedCharID,
        DBState,
        getDatabaseMock,
        setDatabaseMock,
    }
})

vi.mock('./platform', () => ({
    isNodeServer: true,
}))

vi.mock('./globalApi.svelte', () => ({
    forageStorage: storageMocks,
    saveDb: vi.fn(() => {}),
    setPatchSyncBaseline: vi.fn(() => {}),
    getDbBackups: vi.fn(async () => []),
    getUncleanables: getUncleanablesMock,
    getBasename: (data: string) => data.split('/').at(-1) ?? data,
    checkCharOrder: vi.fn(() => {}),
}))

vi.mock('./storage/database.svelte', () => ({
    setDatabase: setDatabaseMock,
    getDatabase: getDatabaseMock,
    defaultSdDataFunc: vi.fn(() => ({})),
}))

vi.mock('./storage/risuSave', () => ({
    decodeRisuSave: vi.fn(async () => dbHolder.current),
    encodeRisuSaveLegacy: vi.fn(() => new Uint8Array([1, 2, 3])),
}))

vi.mock('./stores.svelte', () => ({
    MobileGUI: createMockStore(false),
    botMakerMode: createMockStore(false),
    selectedCharID,
    loadedStore,
    DBState,
    LoadingStatusState: { text: '' },
}))

vi.mock('./plugins/plugins.svelte', () => ({
    loadPlugins: vi.fn(async () => {}),
}))

vi.mock('./alert', () => ({
    alertError: vi.fn(() => {}),
    alertMd: vi.fn(async () => {}),
    alertTOS: vi.fn(async () => true),
    waitAlert: vi.fn(async () => {}),
    alertConfirm: vi.fn(async () => false),
    alertInput: vi.fn(async () => ''),
}))

vi.mock('./characterCards', () => ({
    characterURLImport: vi.fn(() => {}),
}))

vi.mock('./storage/defaultPrompts', () => ({
    defaultJailbreak: '',
    defaultMainPrompt: '',
    oldJailbreak: '',
    oldMainPrompt: '',
}))

vi.mock('./gui/animation', () => ({
    updateAnimationSpeed: vi.fn(() => {}),
}))

vi.mock('./gui/colorscheme', () => ({
    updateColorScheme: vi.fn(() => {}),
    updateTextThemeAndCSS: vi.fn(() => {}),
}))

vi.mock('./kei/backup', () => ({
    autoServerBackup: vi.fn(() => {}),
}))

vi.mock('src/lang', () => ({
    applyEarlyLanguage: vi.fn(() => {}),
    changeLanguage: vi.fn(() => {}),
    language: {
        bootstrap: {
            dataCorruptionDetected: vi.fn(() => ''),
            reportErrorQuestion: '',
            diagnosticInformation: vi.fn(() => ''),
            resetLorebookQuestion: '',
        },
    },
}))

vi.mock('./observer.svelte', () => ({
    startObserveDom: vi.fn(() => {}),
}))

vi.mock('./gui/guisize', () => ({
    updateGuisize: vi.fn(() => {}),
}))

vi.mock('./characters', () => ({
    updateLorebooks: vi.fn((lorebooks: unknown[]) => lorebooks),
}))

vi.mock('./hotkey', () => ({
    initMobileGesture: vi.fn(() => {}),
}))

vi.mock('./process/modules', () => ({
    moduleUpdate: vi.fn(() => {}),
}))

vi.mock('./process/coldstorage.svelte', () => ({
    makeColdData: vi.fn(() => {}),
}))

vi.mock('./model/modellist', () => ({
    registerModelDynamic: vi.fn(() => {}),
}))

vi.mock('./update', () => ({
    checkRisuUpdate: vi.fn(() => {}),
}))

describe('loadData cleanChunks', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
        dbHolder.reset()
        DBState.db = dbHolder.current
        loadedStore.set(false)
        selectedCharID.set(0)
        storageMocks.keys.mockResolvedValue(['assets/new-bot.png'])
        getUncleanablesMock.mockReturnValue([])
        Object.defineProperty(navigator, 'storage', {
            configurable: true,
            value: {
                persist: vi.fn(async () => true),
            },
        })
    })

    test('does not prune shared assets during boot cleanup on node server', async () => {
        const { loadData } = await import('./bootstrap')

        await loadData()
        await vi.advanceTimersByTimeAsync(5_000)

        expect(storageMocks.removeItem).not.toHaveBeenCalledWith('assets/new-bot.png')
    })

    test('removes assets for trashed characters that expire during boot migration', async () => {
        dbHolder.current.characters = [
            {
                chaId: 'expired-char',
                type: 'character',
                name: 'Expired',
                image: 'assets/expired.png',
                chats: [],
                chatPage: 0,
                customscript: [],
                globalLore: [],
                viewScreen: 'none',
                emotionImages: [],
                trashTime: Date.now() - (1000 * 60 * 60 * 24 * 4),
            },
        ]

        const { loadData } = await import('./bootstrap')

        await loadData()
        await vi.advanceTimersByTimeAsync(5_000)

        expect(storageMocks.removeItem).toHaveBeenCalledWith('assets/expired.png')
    })
})
