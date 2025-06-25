import React from 'react';
import {CodeDiffContainer, FilePair} from './CodeDiffContainer';
import {GitDiffOptions, gitDiffOptionsToFlags} from './diff-options';
import {getUnifiedFileData, UnifiedFileData} from './unified-api';
import {ImageDiff} from './ImageDiff';
import {ImageDiffMode} from './ImageDiffModeSelector';

export type PerceptualDiffMode = 'off' | 'bbox' | 'pixels';

export interface Props {
  thinFilePair: FilePair;
  imageDiffMode: ImageDiffMode;
  pdiffMode: PerceptualDiffMode;
  diffOptions: Partial<GitDiffOptions>;
  normalizeJSON: boolean;
  changeImageDiffMode: (mode: ImageDiffMode) => void;
  changePDiffMode: React.Dispatch<React.SetStateAction<PerceptualDiffMode>>;
  changeDiffOptions: (options: Partial<GitDiffOptions>) => void;
}

export function DiffView(props: Props) {
  const {diffOptions, thinFilePair, normalizeJSON} = props;
  const [unifiedData, setUnifiedData] = React.useState<UnifiedFileData | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        // Fetch everything in one request
        const data = await getUnifiedFileData(
          thinFilePair.idx,
          gitDiffOptionsToFlags(diffOptions),
          normalizeJSON
        );
        setUnifiedData(data);
      } catch (e) {
        console.error('Failed to load file data:', e);
      }
    })();
  }, [thinFilePair.idx, diffOptions, normalizeJSON]);

  if (!unifiedData) {
    return <div>Loading…</div>;
  }

  // Use the thick data from unified response
  const filePair = {
    ...unifiedData.thick,
    idx: thinFilePair.idx
  };

  let diffEl;
  if (filePair.is_image_diff) {
    diffEl = <ImageDiff filePair={filePair} {...props} />;
  } else {
    // Pass the already-loaded data to avoid duplicate fetching
    diffEl = (
      <CodeDiffContainer
        filePair={filePair}
        diffOptions={diffOptions}
        normalizeJSON={normalizeJSON}
        preloadedData={{
          content_a: unifiedData.content_a,
          content_b: unifiedData.content_b,
          diff_ops: unifiedData.diff_ops
        }}
      />
    );
  }

  return diffEl;
}
