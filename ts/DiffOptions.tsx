import React from 'react';

import {DiffAlgorithm, gitDiffOptionsToFlags} from './diff-options';
import {PageCover} from './codediff/PageCover';
import {isLegitKeypress, Unionize} from './utils';
import {Options, UpdateOptionsFn} from './options';

export interface Props {
  options: Partial<Options>;
  updateOptions: UpdateOptionsFn;
  defaultMaxDiffWidth: number;
  isVisible: boolean;
  setIsVisible: (isVisible: boolean) => void;
}

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  marginTop: -8,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const popupStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 3,
  right: 8,
  border: '1px solid #ddd',
  borderRadius: 4,
  padding: 12,
  marginLeft: 8,
  marginTop: 12,
  background: 'white',
  fontSize: '90%',
  userSelect: 'none',
  boxShadow: '0px 0px 8px 0px rgba(0,0,0,0.5)',
  fontFamily: 'sans-serif',
};

type BooleanOptions = Extract<Unionize<Options>, {v: boolean}>['k'];

export function DiffOptionsControl(props: Props) {
  const {options, updateOptions, isVisible, setIsVisible} = props;
  const maxDiffWidth = options.maxDiffWidth ?? props.defaultMaxDiffWidth;

  const togglePopup = () => {
    setIsVisible(!isVisible);
  };
  const toggleField = (k: BooleanOptions) => () => {
    updateOptions(options => ({[k]: !options[k]}));
  };
  const setUnifiedContext: React.ChangeEventHandler<HTMLInputElement> = e => {
    updateOptions({unified: e.currentTarget.valueAsNumber});
  };
  const changeDiffAlgorithm: React.ChangeEventHandler<HTMLSelectElement> = e => {
    updateOptions({diffAlgorithm: e.currentTarget.value as DiffAlgorithm});
  };
  const changeMaxDiffWidth: React.ChangeEventHandler<HTMLInputElement> = e => {
    updateOptions({maxDiffWidth: e.currentTarget.valueAsNumber});
  };

  React.useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isLegitKeypress(e)) return;
      if (e.code == 'KeyW') {
        updateOptions(options => ({ignoreAllSpace: !options.ignoreAllSpace}));
      } else if (e.code == 'KeyB') {
        updateOptions(options => ({ignoreSpaceChange: !options.ignoreSpaceChange}));
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [options, updateOptions]);

  const diffOptsStr = gitDiffOptionsToFlags(options).join(' ');

  return (
    <>
      {isVisible ? (
        <>
          <PageCover onClick={togglePopup} />
          <div style={popupStyle}>
            <button style={closeButtonStyle} onClick={togglePopup}>
              ✕
            </button>
            <table>
              <tbody>
                <tr>
                  <td style={{textAlign: 'right', verticalAlign: 'top'}} rowSpan={3}>
                    Whitespace:
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!options.ignoreAllSpace}
                      id="ignore-all-space"
                      onChange={toggleField('ignoreAllSpace')}
                    />{' '}
                    <label htmlFor="ignore-all-space">
                      Ignore All Space (<code>git diff -w</code>)
                    </label>
                  </td>
                </tr>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!options.ignoreSpaceChange}
                      id="ignore-space-changes"
                      onChange={toggleField('ignoreSpaceChange')}
                    />{' '}
                    <label htmlFor="ignore-space-changes">
                      Ignore Space Changes (<code>git diff -b</code>)
                    </label>
                  </td>
                </tr>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!options.normalizeJSON}
                      id="normalize-json"
                      onChange={toggleField('normalizeJSON')}
                    />{' '}
                    <label htmlFor="normalize-json">Normalize JSON</label>
                  </td>
                </tr>
                <tr>
                  <td style={{textAlign: 'right', verticalAlign: 'top'}} rowSpan={2}>
                    Context:
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={options.unified ?? 8}
                      onChange={setUnifiedContext}
                    />{' '}
                    lines
                  </td>
                </tr>
                <tr>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!options.functionContext}
                      id="function-context"
                      onChange={toggleField('functionContext')}
                    />{' '}
                    <label htmlFor="function-context">
                      Function Context (<code>git diff -W</code>)
                    </label>
                  </td>
                </tr>
                <tr>
                  <td style={{textAlign: 'right'}}>Diff Algorithm:</td>
                  <td>
                    <select value={options.diffAlgorithm ?? 'myers'} onChange={changeDiffAlgorithm}>
                      <option value="myers">Myers (Default)</option>
                      <option value="patience">Patience</option>
                      <option value="minimal">Minimal</option>
                      <option value="histogram">Histogram</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td style={{textAlign: 'right', verticalAlign: 'top'}}>Max line width:</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxDiffWidth}
                      onChange={changeMaxDiffWidth}
                    />{' '}
                    lines
                  </td>
                </tr>
              </tbody>
            </table>

            {diffOptsStr ? <pre>git diff {diffOptsStr}</pre> : null}
            {maxDiffWidth !== props.defaultMaxDiffWidth ? (
              <pre>git config webdiff.maxDiffWidth {maxDiffWidth}</pre>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
