import type { Database } from "./storage/database.svelte"
import { forageStorage, getUncleanables } from "./globalApi.svelte"

type AssetOwner = {
    image?: string
    emotionImages?: [string, string][]
    additionalAssets?: [string, string, string][]
    vits?: {
        files?: Record<string, string>
    }
    ccAssets?: Array<{
        uri: string
    }>
}

function addAssetPath(paths: Set<string>, asset?: string) {
    if (!asset || !asset.startsWith('assets/')) {
        return
    }
    paths.add(asset)
}

export function getCharacterAssetPaths(char: AssetOwner): string[] {
    const assetPaths = new Set<string>()

    addAssetPath(assetPaths, char.image)

    for (const emotion of char.emotionImages ?? []) {
        addAssetPath(assetPaths, emotion[1])
    }

    for (const asset of char.additionalAssets ?? []) {
        addAssetPath(assetPaths, asset[1])
    }

    for (const asset of Object.values(char.vits?.files ?? {})) {
        addAssetPath(assetPaths, asset)
    }

    for (const asset of char.ccAssets ?? []) {
        addAssetPath(assetPaths, asset.uri)
    }

    return Array.from(assetPaths)
}

export async function removeUnusedCharacterAssets(char: AssetOwner | null | undefined, db: Database) {
    if (!char) {
        return
    }

    const removedAssets = getCharacterAssetPaths(char)
    if (removedAssets.length === 0) {
        return
    }

    const stillReferencedAssets = new Set(
        getUncleanables(db, 'pure').filter((asset) => asset.startsWith('assets/'))
    )

    for (const assetPath of removedAssets) {
        if (stillReferencedAssets.has(assetPath)) {
            continue
        }
        try {
            await forageStorage.removeItem(assetPath)
        } catch (error) {
            console.error(`[assetCleanup] failed to remove ${assetPath}`, error)
        }
    }
}
