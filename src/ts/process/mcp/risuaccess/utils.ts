import { getCurrentCharacter, type character } from 'src/ts/storage/database.svelte'
import { DBState } from 'src/ts/stores.svelte'

export function getCharacter(id: string): character {
  return id ? DBState.db.characters.find((c) => c.chaId === id || c.name === id) : getCurrentCharacter()
}
