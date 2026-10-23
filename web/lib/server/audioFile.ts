/**
 * Spec 7: only WebM (Opus) or MP4 (AAC) recordings are accepted, and their length must be
 * 5–62 seconds. This reads the container directly, so it doesn't trust what the browser
 * says. ffmpeg checks again in M2. Returns null for the duration if the file doesn't say.
 */
export type AudioKind = "audio/webm" | "audio/mp4";

export function sniffAudio(data: Buffer): AudioKind | null {
  if (data.length >= 4 && data.readUInt32BE(0) === 0x1a45dfa3) return "audio/webm";
  if (data.length >= 8 && data.toString("latin1", 4, 8) === "ftyp") return "audio/mp4";
  return null;
}

export function audioDurationMs(data: Buffer, kind: AudioKind): number | null {
  try {
    const ms = kind === "audio/webm" ? webmDurationMs(data) : mp4DurationMs(data);
    return ms !== null && Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null;
  } catch {
    return null;
  }
}

// --- WebM (Matroska / EBML) ---------------------------------------------------------

const EBML = {
  segment: 0x18538067,
  info: 0x1549a966,
  timecodeScale: 0x2ad7b1,
  duration: 0x4489,
  cluster: 0x1f43b675,
  timecode: 0xe7,
  simpleBlock: 0xa3,
  blockGroup: 0xa0,
  block: 0xa1,
};

/** Elements we step into rather than over. MediaRecorder writes them with unknown sizes. */
const DESCEND = new Set([EBML.segment, EBML.info, EBML.cluster, EBML.blockGroup]);

function vintLength(first: number): number {
  for (let length = 1; length <= 8; length++) if (first & (0x80 >> (length - 1))) return length;
  throw new Error("Bad EBML number");
}

function readId(data: Buffer, at: number) {
  const length = vintLength(data[at]);
  let id = 0;
  for (let i = 0; i < length; i++) id = id * 256 + data[at + i];
  return { id, length };
}

function readSize(data: Buffer, at: number) {
  const length = vintLength(data[at]);
  let value = data[at] & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i++) {
    value = value * 256 + data[at + i];
    if (data[at + i] !== 0xff) allOnes = false;
  }
  return { size: allOnes ? null : value, length };
}

function readUint(data: Buffer, at: number, size: number): number {
  let value = 0;
  for (let i = 0; i < size; i++) value = value * 256 + data[at + i];
  return value;
}

function webmDurationMs(data: Buffer): number | null {
  let scale = 1_000_000; // nanoseconds per timecode unit (the Matroska default)
  let declared: number | null = null;
  let clusterTimecode = 0;
  let latest = -1;

  const blockTime = (at: number) => {
    const track = vintLength(data[at]);
    const relative = data.readInt16BE(at + track);
    latest = Math.max(latest, clusterTimecode + relative);
  };

  let at = 0;
  while (at < data.length - 1) {
    const { id, length: idLength } = readId(data, at);
    const { size, length: sizeLength } = readSize(data, at + idLength);
    const body = at + idLength + sizeLength;

    if (DESCEND.has(id)) {
      at = body;
      continue;
    }
    if (size === null || body + size > data.length) break;

    if (id === EBML.timecodeScale) scale = readUint(data, body, size);
    else if (id === EBML.duration) declared = size === 4 ? data.readFloatBE(body) : data.readDoubleBE(body);
    else if (id === EBML.timecode) clusterTimecode = readUint(data, body, size);
    else if (id === EBML.simpleBlock || id === EBML.block) blockTime(body);
    at = body + size;
  }

  if (declared && declared > 0) return (declared * scale) / 1e6;
  return latest >= 0 ? (latest * scale) / 1e6 : null;
}

// --- MP4 (ISO base media) -----------------------------------------------------------

const MP4_DESCEND = new Set(["moov", "trak", "mdia", "mvex", "moof", "traf"]);

function mp4DurationMs(data: Buffer): number | null {
  let movieScale = 0;
  let movieDuration = 0;
  let fragmentDuration = 0;
  let trackScale = 0;
  let trexDefault = 0;
  let tfhdDefault = 0;
  let sampleTotal = 0;

  const walk = (start: number, end: number) => {
    let at = start;
    while (at + 8 <= end) {
      let size = data.readUInt32BE(at);
      const type = data.toString("latin1", at + 4, at + 8);
      let header = 8;
      if (size === 1) {
        size = Number(data.readBigUInt64BE(at + 8));
        header = 16;
      } else if (size === 0) {
        size = end - at;
      }
      if (size < header || at + size > end) return;
      const body = at + header;
      const version = data[body];

      if (MP4_DESCEND.has(type)) walk(body, at + size);
      else if (type === "mvhd") {
        movieScale = data.readUInt32BE(body + (version === 1 ? 20 : 12));
        movieDuration = version === 1 ? Number(data.readBigUInt64BE(body + 24)) : data.readUInt32BE(body + 16);
      } else if (type === "mehd") {
        fragmentDuration = version === 1 ? Number(data.readBigUInt64BE(body + 4)) : data.readUInt32BE(body + 4);
      } else if (type === "mdhd" && !trackScale) {
        trackScale = data.readUInt32BE(body + (version === 1 ? 20 : 12));
      } else if (type === "trex") {
        trexDefault = data.readUInt32BE(body + 12);
      } else if (type === "tfhd") {
        const flags = data.readUInt32BE(body) & 0xffffff;
        let field = body + 8; // version/flags, track id
        if (flags & 0x01) field += 8; // base data offset
        if (flags & 0x02) field += 4; // sample description index
        tfhdDefault = flags & 0x08 ? data.readUInt32BE(field) : trexDefault;
      } else if (type === "trun") {
        const flags = data.readUInt32BE(body) & 0xffffff;
        const count = data.readUInt32BE(body + 4);
        let field = body + 8;
        if (flags & 0x001) field += 4;
        if (flags & 0x004) field += 4;
        const perSample = [0x100, 0x200, 0x400, 0x800].filter((bit) => flags & bit).length * 4;
        for (let i = 0; i < count; i++) {
          sampleTotal += flags & 0x100 ? data.readUInt32BE(field) : tfhdDefault;
          field += perSample;
        }
      }
      at += size;
    }
  };
  walk(0, data.length);

  if (movieScale && movieDuration) return (movieDuration / movieScale) * 1000;
  if (movieScale && fragmentDuration) return (fragmentDuration / movieScale) * 1000;
  if (trackScale && sampleTotal) return (sampleTotal / trackScale) * 1000;
  return null;
}
