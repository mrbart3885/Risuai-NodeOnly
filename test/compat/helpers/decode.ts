/**
 * Decode a RisuAI .bin backup into its constituent entries.
 *
 * Binary format per entry:
 *   [nameLength: UInt32LE][name: UTF-8][dataLength: UInt32LE][data: bytes]
 */

export interface BackupEntry {
  name: string
  data: Buffer
}

export function decodeBackup(buf: Buffer): BackupEntry[] {
  const entries: BackupEntry[] = []
  let offset = 0
  while (offset < buf.length) {
    if (offset + 4 > buf.length) throw new Error(`Truncated backup at offset ${offset}: cannot read name length`)

    const nameLen = buf.readUInt32LE(offset)
    offset += 4
    if (nameLen > 1024) throw new Error(`Suspicious name length ${nameLen} at offset ${offset - 4}`)
    if (offset + nameLen > buf.length) throw new Error(`Truncated backup: name extends past end`)

    const name = buf.toString('utf-8', offset, offset + nameLen)
    offset += nameLen

    if (offset + 4 > buf.length) throw new Error(`Truncated backup at offset ${offset}: cannot read data length`)
    const dataLen = buf.readUInt32LE(offset)
    offset += 4
    if (offset + dataLen > buf.length) throw new Error(`Truncated backup: data extends past end`)

    const data = buf.subarray(offset, offset + dataLen)
    offset += dataLen

    entries.push({ name, data })
  }
  return entries
}
