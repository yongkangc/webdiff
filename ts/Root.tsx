import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePair } from './CodeDiffContainer';
import { PerceptualDiffMode } from './DiffView';
import { isLegitKeypress } from './utils';
import { ImageDiffMode } from './ImageDiffModeSelector';
import { DiffOptionsControl } from './DiffOptions';
import { KeyboardShortcuts } from './codediff/KeyboardShortcuts';
import { Options, encodeOptions, ServerConfig, parseOptions, UpdateOptionsFn } from './options';
import { MultiFileView } from './MultiFileView';

declare const pairs: FilePair[];
declare const SERVER_CONFIG: ServerConfig;

// Webdiff application root.
export function Root() {
  const [pdiffMode, setPDiffMode] = React.useState<PerceptualDiffMode>('off');
  const [imageDiffMode, setImageDiffMode] = React.useState<ImageDiffMode>('side-by-side');
  const [showKeyboardHelp, setShowKeyboardHelp] = React.useState(false);
  const [showOptions, setShowOptions] = React.useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  // Set document title
  React.useEffect(() => {
    document.title = `Diff: ${pairs.length} file${pairs.length !== 1 ? 's' : ''}`;
  }, []);

  const options = React.useMemo(() => parseOptions(searchParams), [searchParams]);
  // TODO: merge defaults into options
  const maxDiffWidth = options.maxDiffWidth ?? SERVER_CONFIG.webdiff.maxDiffWidth;
  const normalizeJSON = !!options.normalizeJSON;

  const setDiffOptions = React.useCallback(
    (newOptions: Partial<Options>) => {
      setSearchParams(encodeOptions(newOptions));
    },
    [setSearchParams],
  );

  const updateOptions = React.useCallback<UpdateOptionsFn>(
    update => {
      setDiffOptions({ ...options, ...(typeof update === 'function' ? update(options) : update) });
    },
    [options, setDiffOptions],
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isLegitKeypress(e)) return;
      if (e.code === 'Slash' && e.shiftKey) {
        setShowKeyboardHelp(val => !val);
      } else if (e.code === 'Escape') {
        setShowKeyboardHelp(false);
      } else if (e.code === 'Period') {
        setShowOptions(val => !val);
      } else if (e.code === 'KeyZ') {
        updateOptions(o => ({ normalizeJSON: !o.normalizeJSON }));
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [updateOptions]);

  const inlineStyle = `
  td.code {
    width: ${1 + maxDiffWidth}ch;
  }`;

  return (
    <>
      <style>{inlineStyle}</style>
      <div>
        <div
          style={{
            position: 'sticky',
            float: 'right',
            marginTop: -10,
            marginLeft: 8,
            marginRight: 10,
            zIndex: 1,
            top: 10,
            background: '#e0e0e0',
            border: '1px solid #999',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
            padding: '4px',
            display: 'flex',
            gap: '4px',
          }}
        >
          <button
            style={{
              border: '1px solid #bbb',
              fontSize: '17px',
              background: 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '4px',
              color: '#333',
              fontWeight: 'bold',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #e8e8e8, #d8d8d8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
            }}
            onClick={() => setShowOptions(val => !val)}
            title="Settings"
          >
            ⚙
          </button>
          <button
            style={{
              border: '1px solid #bbb',
              fontSize: '17px',
              background: 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)',
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: '4px',
              color: '#333',
              fontWeight: 'bold',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #e8e8e8, #d8d8d8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.1)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.8)';
            }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
            title="Scroll to top"
          >
            ↑
          </button>
        </div>
        <DiffOptionsControl
          options={options}
          updateOptions={updateOptions}
          defaultMaxDiffWidth={SERVER_CONFIG.webdiff.maxDiffWidth}
          isVisible={showOptions}
          setIsVisible={setShowOptions}
        />
        {showKeyboardHelp ? (
          <KeyboardShortcuts
            onClose={() => {
              setShowKeyboardHelp(false);
            }}
          />
        ) : null}
        <MultiFileView
          filePairs={pairs}
          imageDiffMode={imageDiffMode}
          pdiffMode={pdiffMode}
          diffOptions={options}
          changeImageDiffMode={setImageDiffMode}
          changePDiffMode={setPDiffMode}
          changeDiffOptions={setDiffOptions}
          normalizeJSON={normalizeJSON}
        />
      </div>
    </>
  );
}
