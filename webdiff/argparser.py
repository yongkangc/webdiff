"""Parse command line arguments to webdiff."""

import argparse
import os

from webdiff.localfilediff import LocalFileDiff


class UsageError(Exception):
    pass


USAGE = """Usage: webdiff <left_dir> <right_dir>
       webdiff <left_file> <right_file>

Or run "git webdiff" from a git repository.
"""


def parse(args):
    parser = argparse.ArgumentParser(description='Run webdiff.', usage=USAGE)
    parser.add_argument(
        '--host',
        type=str,
        help='Host name on which to serve webdiff UI. Default is localhost.',
        default='localhost',
    )
    parser.add_argument(
        '--port', '-p', type=int, help='Port to run webdiff on.', default=-1
    )
    parser.add_argument(
        '--root-path', type=str, help='Root path for the application (e.g., /webdiff).', default=''
    )
    parser.add_argument(
        '--timeout', type=int, help='Automatically shut down the server after this many minutes.', default=0
    )

    # Webdiff configuration options
    parser.add_argument(
        '--unified', type=int, help='Number of unified context lines.', default=8
    )
    parser.add_argument(
        '--extra-dir-diff-args', type=str, help='Extra arguments for directory diff.', default=''
    )
    parser.add_argument(
        '--extra-file-diff-args', type=str, help='Extra arguments for file diff.', default=''
    )
    parser.add_argument(
        '--max-diff-width', type=int, help='Maximum width for diff display.', default=160
    )
    parser.add_argument(
        '--theme', type=str, help='Color theme for syntax highlighting.', default='googlecode'
    )
    parser.add_argument(
        '--max-lines-for-syntax', type=int, help='Maximum lines for syntax highlighting.', default=25000
    )

    # Diff algorithm option
    parser.add_argument(
        '--diff-algorithm', type=str, help='Diff algorithm to use.',
        choices=['myers', 'minimal', 'patience', 'histogram'], default=None
    )

    # Color configuration options
    parser.add_argument(
        '--color-insert', type=str, help='Background color for inserted lines.', default='#efe'
    )
    parser.add_argument(
        '--color-delete', type=str, help='Background color for deleted lines.', default='#fee'
    )
    parser.add_argument(
        '--color-char-insert', type=str, help='Background color for inserted characters.', default='#cfc'
    )
    parser.add_argument(
        '--color-char-delete', type=str, help='Background color for deleted characters.', default='#fcc'
    )

    parser.add_argument(
        'dirs',
        type=str,
        nargs='*',
        help='Directories or files to diff.',
    )
    args = parser.parse_args(args=args)

    # Build configuration structure compatible with old git config format
    config = {
        'webdiff': {
            'unified': args.unified,
            'extraDirDiffArgs': args.extra_dir_diff_args,
            'extraFileDiffArgs': args.extra_file_diff_args,
            'port': args.port,
            'host': args.host,
            'rootPath': args.root_path,
            'maxDiffWidth': args.max_diff_width,
            'theme': args.theme,
            'maxLinesForSyntax': args.max_lines_for_syntax,
        },
        'webdiff.colors': {
            'insert': args.color_insert,
            'delete': args.color_delete,
            'charInsert': args.color_char_insert,
            'charDelete': args.color_char_delete,
        },
        'diff': {
            'algorithm': args.diff_algorithm,
        }
    }

    # TODO: convert out to a dataclass
    out = {
        'config': config,
        'port': args.port,
        'host': args.host,
        'timeout': args.timeout,
    }

    if len(args.dirs) > 2:
        raise UsageError('You must specify two files/dirs (got %d)' % len(args.dirs))

    if len(args.dirs) == 2:
        a, b = args.dirs
        if os.environ.get('WEBDIFF_DIR_A') and os.environ.get('WEBDIFF_DIR_B'):
            # This happens when you run "git webdiff" and we have to make a copy of
            # the temp directories before we detach and git difftool cleans them up.
            a = os.environ.get('WEBDIFF_DIR_A')
            b = os.environ.get('WEBDIFF_DIR_B')

        for x in (a, b):
            if not os.path.exists(x):
                raise UsageError('"%s" does not exist' % x)

        a_dir = os.path.isdir(a)
        b_dir = os.path.isdir(b)
        if a_dir and not b_dir:
            raise UsageError('"%s" is a directory but "%s" is not' % (a, b))
        if not a_dir and b_dir:
            raise UsageError('"%s" is a directory but "%s" is not' % (b, a))

        if a_dir and b_dir:
            out['dirs'] = (a, b)
        else:
            out['files'] = (a, b)

    return out


# TODO: move into dirdiff?
def _shim_for_file_diff(a_file, b_file):
    """Returns a LocalFileDiff object for a one-file diff."""
    return LocalFileDiff(
        a_root=os.path.dirname(a_file),
        a_path=a_file,
        b_root=os.path.dirname(b_file),
        b_path=b_file,
        is_move=False,  # probably not a move
    )
