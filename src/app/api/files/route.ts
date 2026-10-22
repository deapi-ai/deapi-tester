import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import { MEDIA_EXTENSIONS, MediaKind, mediaKindFromName } from '@/lib/media-types';
import * as fs from 'fs';
import * as path from 'path';

interface OutputFile {
  name: string;
  size: number;
  modified: number;
  kind: MediaKind;
  url: string;
}

const KNOWN_KINDS = Object.keys(MEDIA_EXTENSIONS) as Exclude<MediaKind, 'other'>[];

// GET /api/files?kind=image|video|audio - List saved result files from the output
// directory. Without `kind` every media file is returned; an unknown kind is a 400
// rather than a silently empty list.
export async function GET(request: Request) {
  try {
    const kindParam = new URL(request.url).searchParams.get('kind');
    if (kindParam && !KNOWN_KINDS.includes(kindParam as Exclude<MediaKind, 'other'>)) {
      return NextResponse.json(
        { error: `Unknown kind "${kindParam}". Expected one of: ${KNOWN_KINDS.join(', ')}` },
        { status: 400 }
      );
    }

    const config = loadConfig();
    const outputDir = path.resolve(process.cwd(), config.outputDir);

    if (!fs.existsSync(outputDir)) {
      return NextResponse.json([]);
    }

    const entries = fs.readdirSync(outputDir, { withFileTypes: true });

    const files: OutputFile[] = entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ entry, kind: mediaKindFromName(entry.name) }))
      .filter(({ kind }) => (kindParam ? kind === kindParam : kind !== 'other'))
      .map(({ entry, kind }) => {
        const stat = fs.statSync(path.join(outputDir, entry.name));
        return {
          name: entry.name,
          size: stat.size,
          modified: stat.mtimeMs,
          kind,
          url: `/api/files/${encodeURIComponent(entry.name)}`,
        };
      })
      .sort((a, b) => b.modified - a.modified);

    return NextResponse.json(files);
  } catch (error) {
    console.error('[deapi-tester] GET /api/files error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
