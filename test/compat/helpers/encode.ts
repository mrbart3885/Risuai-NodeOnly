/**
 * Encode backup entries in the RisuAI .bin format.
 *
 * Binary format per entry:
 *   [nameLength: UInt32LE][name: UTF-8][dataLength: UInt32LE][data: bytes]
 */

export function encodeBackupEntry(name: string, data: Buffer): Buffer {
  const nameBytes = Buffer.from(name, 'utf-8')
  const buf = Buffer.alloc(4 + nameBytes.length + 4 + data.length)
  buf.writeUInt32LE(nameBytes.length, 0)
  nameBytes.copy(buf, 4)
  buf.writeUInt32LE(data.length, 4 + nameBytes.length)
  data.copy(buf, 4 + nameBytes.length + 4)
  return buf
}

export function encodeBackup(entries: Array<{ name: string; data: Buffer }>): Buffer {
  return Buffer.concat(entries.map(e => encodeBackupEntry(e.name, e.data)))
}
