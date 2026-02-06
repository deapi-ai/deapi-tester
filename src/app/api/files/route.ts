import { NextResponse } from 'next/server';
import { loadConfig } from '@/lib/config';
import * as fs from 'fs';
import * as path from 'path';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp']);

interface OutputFile {
  name: string;
  size: number;
  modified: number;
  url: string;
}

// GET /api/files - List image files from output directory
export async function GET() {
  try {
    const config = loadConfig();
    const outputDir = path.resolve(process.cwd(), config.outputDir);

    if (!fs.existsSync(outputDir)) {
      return NextResponse.json([]);
    }

    const entries = fs.readdirSync(outputDir, { withFileTypes: true });

    const files: OutputFile[] = entries
      .filter((entry) => {
        if (!entry.isFile()) return false;
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext);
      })
      .map((entry) => {
        const filePath = path.join(outputDir, entry.name);
        const stat = fs.statSync(filePath);
        return {
          name: entry.name,
          size: stat.size,
          modified: stat.mtimeMs,
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
