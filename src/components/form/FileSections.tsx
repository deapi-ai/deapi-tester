'use client';

import { Info } from 'lucide-react';
import { EndpointParam } from '@/lib/types';
import { FilePreview } from '@/lib/form-utils';
import { FileSection, FormFiles } from '@/lib/form-payload';
import { FileUploadField, AddMode } from '@/components/form/FileUploadField';

interface FileSectionsProps {
  sections: FileSection[];
  files: FormFiles;
  filePreviews: Record<string, FilePreview[]>;
  multiFileMode: Record<string, boolean>;
  maxFiles: (param: EndpointParam) => number | undefined;
  onFileChange: (name: string, files: File[] | null, mode: AddMode) => void;
  onRemoveFile: (name: string, index: number) => void;
  onReorderFiles: (name: string, from: number, to: number) => void;
  onModeChange: (name: string, isMulti: boolean) => void;
}

/** The endpoint's file fields, in the titled sections the registry groups them into. */
export function FileSections({
  sections,
  files,
  filePreviews,
  multiFileMode,
  maxFiles,
  onFileChange,
  onRemoveFile,
  onReorderFiles,
  onModeChange,
}: FileSectionsProps) {
  return (
    <>
      {sections.map((section) => (
        <div
          key={section.title ?? '_ungrouped'}
          className={`flex-shrink-0 ${
            section.title ? 'rounded border border-[var(--border)] bg-[var(--surface)]/40 px-2 pt-1.5 pb-2' : ''
          }`}
        >
          {section.title && (
            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">
                {section.title}
              </span>
              {section.note && (
                <span className="text-[9px] text-[var(--muted)] truncate" title={section.note}>
                  {section.note}
                </span>
              )}
            </div>
          )}
          <div
            className="grid gap-2"
            // One column per field, up to three, so an empty field stays the
            // width of its control instead of stretching across the panel.
            style={{ gridTemplateColumns: `repeat(${Math.min(section.params.length, 3)}, minmax(0, 1fr))` }}
          >
            {section.params.map((param) => {
              const isMulti = !!(param.multiFieldName && multiFileMode[param.name]);
              const chosen = files[param.name];
              const count = chosen ? (Array.isArray(chosen) ? chosen.length : 1) : 0;
              // A list of tiles needs the width; an empty field does not, so
              // fields share a row until one of them actually holds files.
              const wide = isMulti && count > 0;
              return (
                <div key={param.name} className={wide ? 'col-span-full min-w-0' : 'min-w-0'}>
                  <label
                    className="flex items-baseline gap-1 text-xs text-[var(--text-secondary)] mb-1"
                    title={param.description}
                  >
                    {param.label}
                    {param.required && <span className="text-red-500">*</span>}
                    {param.description && <Info className="w-2.5 h-2.5 text-[var(--text-faint)] self-center" />}
                  </label>
                  <FileUploadField
                    name={param.name}
                    label={param.label}
                    required={param.required}
                    accept={param.accept}
                    multiFieldName={param.multiFieldName}
                    multiOnly={param.multiOnly}
                    maxFiles={maxFiles(param)}
                    files={chosen}
                    isMultiMode={isMulti}
                    previews={filePreviews[param.name] || []}
                    onFileChange={onFileChange}
                    onRemoveFile={onRemoveFile}
                    onReorderFiles={onReorderFiles}
                    onModeChange={onModeChange}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
