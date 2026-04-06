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
    alertConfirmMock,
    selectedCharID,
    requiresFullEncoderReload,
    setDatabaseMock,
    getDatabaseMock,
} = vi.hoisted(() => {
    type MockCharacter = {
        chaId: string
        type: string
        name: string
        image: string
        chats: unknown[]
        chatPage: number
        customscript: unknown[]
        globalLore: unknown[]
        viewScreen: string
        emotionImages: [string, string][]
        additionalAssets?: [string, string, string][]
        vits?: {
            files?: Record<string, string>
        }
        ccAssets?: Array<{
            uri: string
        }>
    }

    const createCharacter = (overrides: Partial<MockCharacter> = {}): MockCharacter => ({
        chaId: 'char-id',
        type: 'character',
        name: 'Character',
        image: '',
        chats: [],
        chatPage: 0,
        customscript: [],
        globalLore: [],
        viewScreen: 'none',
        emotionImages: [],
        ...overrides,
    })

    const dbHolder = {
        current: {
            characters: [] as MockCharacter[],
            modules: [],
            personas: [],
            customBackground: '',
            userIcon: '',
            characterOrder: [],
        },
        reset() {
            this.current = {
                characters: [],
                modules: [],
                personas: [],
                customBackground: '',
                userIcon: '',
                characterOrder: [],
            }
        },
        createCharacter,
    }

    const storageMocks = {
        removeItem: vi.fn(async () => {}),
    }

    const alertConfirmMock = vi.fn(async () => true)
    const selectedCharID = createMockStore(-1)
    const requiresFullEncoderReload = { state: false }
    const setDatabaseMock = vi.fn((db: typeof dbHolder.current) => {
        dbHolder.current = db
    })
    const getDatabaseMock = vi.fn(() => dbHolder.current)

    return {
        dbHolder,
        storageMocks,
        alertConfirmMock,
        selectedCharID,
        requiresFullEncoderReload,
        setDatabaseMock,
        getDatabaseMock,
    }
})

vi.mock('./storage/database.svelte', () => ({
    saveImage: vi.fn(async () => ''),
    setDatabase: setDatabaseMock,
    defaultSdDataFunc: vi.fn(() => ({})),
    getDatabase: getDatabaseMock,
    getCharacterByIndex: vi.fn(() => null),
    setCharacterByIndex: vi.fn(() => {}),
    getCurrentChat: vi.fn(() => null),
    loadTogglesFromChat: vi.fn(() => ({})),
}))

vi.mock('./alert', () => ({
    alertAddCharacter: vi.fn(async () => ''),
    alertConfirm: alertConfirmMock,
    alertError: vi.fn(() => {}),
    alertNormal: vi.fn(() => {}),
    alertSelect: vi.fn(async () => '0'),
    alertStore: { set: vi.fn(() => {}) },
    alertWait: vi.fn(async () => {}),
}))

vi.mock('../lang', () => ({
    language: {
        removeConfirm: 'remove:',
        removeConfirm2: 'remove2:',
    },
}))

vi.mock('./util', () => ({
    checkNullish: (value: unknown) => value === null || value === undefined,
    findCharacterbyId: vi.fn(() => null),
    getUserName: vi.fn(() => 'User'),
    selectMultipleFile: vi.fn(async () => []),
    selectSingleFile: vi.fn(async () => null),
}))

vi.mock('./media', () => ({
    getImageType: vi.fn(() => 'PNG'),
}))

vi.mock('./stores.svelte', () => ({
    MobileGUIStack: createMockStore(0),
    OpenRealmStore: createMockStore(false),
    selectedCharID,
}))

vi.mock('./globalApi.svelte', () => ({
    AppendableBuffer: class AppendableBuffer {},
    changeChatTo: vi.fn(() => {}),
    checkCharOrder: vi.fn(() => {}),
    downloadFile: vi.fn(() => {}),
    forageStorage: storageMocks,
    getBasename: (data: string) => data.split('/').at(-1) ?? data,
    getFileSrc: vi.fn(async () => ''),
    getUncleanables: vi.fn((db: typeof dbHolder.current, uptype: 'basename' | 'pure' = 'basename') => {
        const assets = new Set<string>()
        const add = (value?: string) => {
            if (!value) {
                return
            }
            assets.add(uptype === 'basename' ? value.split('/').at(-1) ?? value : value)
        }

        add(db.customBackground)
        add(db.userIcon)
        for (const char of db.characters) {
            add(char.image as string)
            for (const emotion of (char.emotionImages as [string, string][]) ?? []) {
                add(emotion[1])
            }
            for (const asset of (char.additionalAssets as [string, string, string][]) ?? []) {
                add(asset[1])
            }
            const vits = char.vits as { files?: Record<string, string> } | undefined
            for (const value of Object.values(vits?.files ?? {})) {
                add(value)
            }
            for (const asset of (char.ccAssets as Array<{ uri: string }>) ?? []) {
                add(asset.uri)
            }
        }
        return Array.from(assets)
    }),
    requiresFullEncoderReload,
}))

vi.mock('./process/inlayScreen', () => ({
    updateInlayScreen: vi.fn(() => {}),
}))

vi.mock('./parser/parser.svelte', () => ({
    parseMarkdownSafe: vi.fn(() => ''),
}))

vi.mock('./translator/translator', () => ({
    translateHTML: vi.fn(async () => ''),
}))

vi.mock('./process/index.svelte', () => ({
    doingChat: { state: false },
}))

vi.mock('./characterCards', () => ({
    importCharacter: vi.fn(async () => {}),
}))

vi.mock('./pngChunk', () => ({
    PngChunk: {
        readGenerator: vi.fn(async function* () {}),
    },
}))

describe('removeChar asset cleanup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        dbHolder.reset()
        requiresFullEncoderReload.state = false
    })

    test('removes assets that are no longer referenced after permanent delete', async () => {
        dbHolder.current.characters = [
            dbHolder.createCharacter({
                chaId: 'solo',
                name: 'Solo',
                image: 'assets/solo.png',
            }),
        ]

        const { removeChar } = await import('./characters')

        await removeChar(0, 'Solo', 'permanent')

        expect(storageMocks.removeItem).toHaveBeenCalledWith('assets/solo.png')
        expect(dbHolder.current.characters).toHaveLength(0)
    })

    test('keeps assets that are still shared by another character', async () => {
        dbHolder.current.characters = [
            dbHolder.createCharacter({
                chaId: 'first',
                name: 'First',
                image: 'assets/shared.png',
            }),
            dbHolder.createCharacter({
                chaId: 'second',
                name: 'Second',
                image: 'assets/shared.png',
            }),
        ]

        const { removeChar } = await import('./characters')

        await removeChar(0, 'First', 'permanent')

        expect(storageMocks.removeItem).not.toHaveBeenCalledWith('assets/shared.png')
        expect(dbHolder.current.characters).toHaveLength(1)
    })
})
