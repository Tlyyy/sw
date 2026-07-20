export interface ZipArchiveEntry {
  name: string;
  blob: Blob;
}

const UTF8_FLAG = 0x0800;
const STORE_METHOD = 0;
const VERSION = 20;

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < table.length; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(bytes: Uint8Array) {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = crcTable[(checksum ^ byte) & 0xff] ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function dosTimestamp(value: Date) {
  const year = Math.min(2107, Math.max(1980, value.getFullYear()));
  const time = (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2);
  const date = ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate();
  return { time, date };
}

function localHeader(
  name: Uint8Array,
  bytes: Uint8Array,
  checksum: number,
  timestamp: ReturnType<typeof dosTimestamp>,
) {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, UTF8_FLAG, true);
  view.setUint16(8, STORE_METHOD, true);
  view.setUint16(10, timestamp.time, true);
  view.setUint16(12, timestamp.date, true);
  view.setUint32(14, checksum, true);
  view.setUint32(18, bytes.length, true);
  view.setUint32(22, bytes.length, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  header.set(name, 30);
  return header;
}

function centralHeader(
  name: Uint8Array,
  bytes: Uint8Array,
  checksum: number,
  timestamp: ReturnType<typeof dosTimestamp>,
  offset: number,
) {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, UTF8_FLAG, true);
  view.setUint16(10, STORE_METHOD, true);
  view.setUint16(12, timestamp.time, true);
  view.setUint16(14, timestamp.date, true);
  view.setUint32(16, checksum, true);
  view.setUint32(20, bytes.length, true);
  view.setUint32(24, bytes.length, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  header.set(name, 46);
  return header;
}

function endOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number) {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return footer;
}

function ownedArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

export async function createZipArchive(entries: readonly ZipArchiveEntry[], modifiedAt = new Date()) {
  if (!entries.length) throw new Error("压缩包至少需要一个文件");
  if (entries.length > 0xffff) throw new Error("压缩包文件数量过多");

  const encoder = new TextEncoder();
  const timestamp = dosTimestamp(modifiedAt);
  const localParts: ArrayBuffer[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    if (bytes.length > 0xffffffff || localOffset > 0xffffffff) throw new Error("压缩包超过浏览器支持范围");
    const checksum = crc32(bytes);
    const local = localHeader(name, bytes, checksum, timestamp);
    localParts.push(ownedArrayBuffer(local), ownedArrayBuffer(bytes));
    centralParts.push(centralHeader(name, bytes, checksum, timestamp, localOffset));
    localOffset += local.length + bytes.length;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const footer = endOfCentralDirectory(entries.length, centralSize, localOffset);
  return new Blob([
    ...localParts,
    ...centralParts.map(ownedArrayBuffer),
    ownedArrayBuffer(footer),
  ], { type: "application/zip" });
}
