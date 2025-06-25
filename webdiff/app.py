#!/usr/bin/env python

import dataclasses
import json
import logging
import mimetypes
import os
import socket
import sys
import threading
import time
from typing import Optional

from fastapi import FastAPI, Request, Form
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import ClientDisconnect
from starlette.datastructures import Headers
from binaryornot.check import is_binary
import uvicorn

from . import argparser, diff, dirdiff, util

def determine_path():
    """Borrowed from wxglade.py"""
    try:
        root = __file__
        if os.path.islink(root):
            root = os.path.realpath(root)
        return os.path.dirname(os.path.abspath(root))
    except Exception as e:
        print(f"I'm sorry, but something is wrong. Error: {e}")
        print('There is no __file__ variable. Please contact the author.')
        sys.exit()


SERVER_CONFIG = {}
DIFF = None
PORT = None
HOSTNAME = 'localhost'
DEBUG = os.environ.get('DEBUG')
WEBDIFF_DIR = determine_path()

class ClientDisconnectMiddleware(BaseHTTPMiddleware):
    """Middleware to handle client disconnects gracefully."""
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except ClientDisconnect:
            # Client disconnected, just return a simple response
            return JSONResponse({'error': 'Client disconnected'}, status_code=499)

class CachedStaticFiles(StaticFiles):
    """Static files handler with caching headers."""
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)

        # Set cache headers based on file type
        if path.endswith(('.js', '.css')):
            # JavaScript and CSS files: cache for 1 week
            response.headers['Cache-Control'] = 'public, max-age=604800'
        elif path.endswith(('.jpg', '.jpeg', '.png', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot')):
            # Images and fonts: cache for 1 month
            response.headers['Cache-Control'] = 'public, max-age=2592000'
        else:
            # Other files: cache for 1 hour
            response.headers['Cache-Control'] = 'public, max-age=3600'

        return response

def create_app(root_path: str = "") -> FastAPI:
    """Create and configure the FastAPI app with the given root_path."""
    app = FastAPI(root_path=root_path)

    # Add middlewares
    app.add_middleware(ClientDisconnectMiddleware)  # Handle client disconnects
    app.add_middleware(GZipMiddleware)  # Compress responses

    # Mount static files
    static_dir = os.path.join(WEBDIFF_DIR, 'static')
    if not os.path.exists(static_dir):
        # Try to find static dir relative to the package
        import webdiff
        webdiff_package_dir = os.path.dirname(webdiff.__file__)
        static_dir = os.path.join(webdiff_package_dir, 'static')

    app.mount("/static", CachedStaticFiles(directory=static_dir), name="static")

    @app.get("/favicon.ico")
    async def handle_favicon():
        favicon_path = os.path.join(WEBDIFF_DIR, 'static/img/favicon.ico')

        # Try alternate path if the primary one doesn't exist
        if not os.path.exists(favicon_path):
            import webdiff
            webdiff_package_dir = os.path.dirname(webdiff.__file__)
            favicon_path = os.path.join(webdiff_package_dir, 'static/img/favicon.ico')

        return FileResponse(
            favicon_path,
            headers={"Cache-Control": "public, max-age=2592000"}  # Cache for 30 days
        )


    @app.get("/theme.css")
    async def handle_theme():
        try:
            if not SERVER_CONFIG:
                return JSONResponse({'error': 'SERVER_CONFIG not initialized'}, status_code=500)
            theme = SERVER_CONFIG.get('webdiff', {}).get('theme', 'googlecode')
            # Handle both 'googlecode' and 'subfolder/themename' formats
            if '/' in theme:
                theme_dir = os.path.dirname(theme)
                theme_file = os.path.basename(theme)
            else:
                theme_dir = ''
                theme_file = theme

            if theme_dir:
                theme_path = os.path.join(
                    WEBDIFF_DIR, 'static/css/themes', theme_dir, theme_file + '.css'
                )
            else:
                theme_path = os.path.join(
                    WEBDIFF_DIR, 'static/css/themes', theme_file + '.css'
                )

            # Try alternate path if the primary one doesn't exist
            if not os.path.exists(theme_path):
                import webdiff
                webdiff_package_dir = os.path.dirname(webdiff.__file__)
                if theme_dir:
                    theme_path = os.path.join(
                        webdiff_package_dir, 'static/css/themes', theme_dir, theme_file + '.css'
                    )
                else:
                    theme_path = os.path.join(
                        webdiff_package_dir, 'static/css/themes', theme_file + '.css'
                    )

            return FileResponse(theme_path)
        except Exception as e:
            logging.error(f"Error in handle_theme: {e}")
            return JSONResponse({'error': str(e)}, status_code=500)


    @app.get("/")
    @app.get("/{idx}")
    async def handle_index(request: Request, idx: Optional[int] = None):
        global DIFF
        try:
            index_path = os.path.join(WEBDIFF_DIR, 'templates/file_diff.html')

            # Debug logging
            if DEBUG:
                logging.info(f"WEBDIFF_DIR: {WEBDIFF_DIR}")
                logging.info(f"Looking for template at: {index_path}")
                logging.info(f"Template exists: {os.path.exists(index_path)}")

            # Try alternate paths if the primary one doesn't exist
            if not os.path.exists(index_path):
                # Try to find the template relative to the package
                import webdiff
                webdiff_package_dir = os.path.dirname(webdiff.__file__)
                index_path = os.path.join(webdiff_package_dir, 'templates/file_diff.html')

                if DEBUG:
                    logging.info(f"Trying package path: {index_path}")
                    logging.info(f"Template exists at package path: {os.path.exists(index_path)}")

            with open(index_path) as f:
                html = f.read()

                # Inject the root path into the data
                data = {
                    'idx': idx if idx is not None else 0,
                    'has_magick': util.is_imagemagick_available(),
                    'pairs': diff.get_thin_list(DIFF),
                    'server_config': SERVER_CONFIG,
                    'root_path': app.root_path,
                }

                html = html.replace(
                    '{{data}}',
                    json.dumps(data, indent=2)
                )
            return HTMLResponse(content=html)
        except Exception as e:
            logging.error(f"Error handling index: {e}")
            logging.error(f"WEBDIFF_DIR was: {WEBDIFF_DIR}")
            return JSONResponse({'error': str(e)}, status_code=500)




    @app.get("/file/{idx}")
    async def get_file_complete(
        idx: int,
        normalize_json: bool = False,
        options: Optional[str] = None  # Comma-separated diff options
    ):
        """Get all data needed to render a file diff in one request."""
        global DIFF, SERVER_CONFIG

        # Validate index
        if idx < 0 or idx >= len(DIFF):
            return JSONResponse({'error': f'Invalid index {idx}'}, status_code=400)

        file_pair = DIFF[idx]

        # Get thick data (metadata)
        thick_data = diff.get_thick_dict(file_pair)

        # Prepare response
        response = {
            'idx': idx,
            'thick': thick_data,
            'content_a': None,
            'content_b': None,
            'diff_ops': []
        }

        # Get content for side A
        if file_pair.a:
            try:
                abs_path_a = file_pair.a_path
                if is_binary(abs_path_a):
                    response['content_a'] = f'Binary file ({os.path.getsize(abs_path_a)} bytes)'
                else:
                    path_to_read = util.normalize_json(abs_path_a) if normalize_json else abs_path_a
                    with open(path_to_read, 'r') as f:
                        response['content_a'] = f.read()
            except Exception as e:
                response['content_a'] = f'Error reading file: {str(e)}'

        # Get content for side B
        if file_pair.b:
            try:
                abs_path_b = file_pair.b_path
                if is_binary(abs_path_b):
                    response['content_b'] = f'Binary file ({os.path.getsize(abs_path_b)} bytes)'
                else:
                    path_to_read = util.normalize_json(abs_path_b) if normalize_json else abs_path_b
                    with open(path_to_read, 'r') as f:
                        response['content_b'] = f.read()
            except Exception as e:
                response['content_b'] = f'Error reading file: {str(e)}'

        # Get diff operations
        try:
            diff_options = options.split(',') if options else []
            extra_args = SERVER_CONFIG['webdiff'].get('extraFileDiffArgs', '')
            if extra_args:
                diff_options += extra_args.split(' ')

            diff_ops = [
                dataclasses.asdict(op)
                for op in diff.get_diff_ops(file_pair, diff_options, normalize_json=normalize_json)
            ]
            response['diff_ops'] = diff_ops
        except Exception as e:
            # Still return file contents even if diff fails
            response['diff_error'] = str(e)

        return JSONResponse(response)

    @app.get("/{side}/image/{path:path}")
    async def handle_get_image(side: str, path: str):
        global DIFF
        mime_type, _ = mimetypes.guess_type(path)
        if not mime_type or not mime_type.startswith('image/'):
            return JSONResponse({'error': 'wrong type'}, status_code=400)

        idx = diff.find_diff_index(DIFF, side, path)
        if idx is None:
            return JSONResponse({'error': 'not found'}, status_code=400)

        d = DIFF[idx]
        abs_path = d.a_path if side == 'a' else d.b_path
        return FileResponse(abs_path, media_type=mime_type)


    @app.get("/pdiff/{idx}")
    async def handle_pdiff(idx: int):
        global DIFF
        d = DIFF[idx]
        try:
            _, pdiff_image = util.generate_pdiff_image(d.a_path, d.b_path)
            dilated_image_path = util.generate_dilated_pdiff_image(pdiff_image)
            return FileResponse(dilated_image_path)
        except util.ImageMagickNotAvailableError:
            return Response(content='ImageMagick is not available', status_code=501)
        except util.ImageMagickError as e:
            return Response(content=f'ImageMagick error {e}', status_code=501)


    @app.get("/pdiffbbox/{idx}")
    async def handle_pdiff_bbox(idx: int):
        global DIFF
        d = DIFF[idx]
        try:
            _, pdiff_image = util.generate_pdiff_image(d.a_path, d.b_path)
            bbox = util.get_pdiff_bbox(pdiff_image)
            return JSONResponse(bbox)
        except util.ImageMagickNotAvailableError:
            return JSONResponse('ImageMagick is not available', status_code=501)
        except util.ImageMagickError as e:
            return JSONResponse(f'ImageMagick error {e}', status_code=501)

    return app





def random_port():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.bind(('', 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def find_port(webdiff_config):
    if webdiff_config['port'] != -1:
        return webdiff_config['port']
    return random_port()


def run():
    global DIFF, PORT, HOSTNAME, SERVER_CONFIG
    try:
        parsed_args = argparser.parse(sys.argv[1:])
    except argparser.UsageError as e:
        sys.stderr.write('Error: %s\n\n' % e)
        sys.stderr.write(argparser.USAGE)
        sys.exit(1)

    SERVER_CONFIG = parsed_args['config']
    WEBDIFF_CONFIG = SERVER_CONFIG['webdiff']
    HOSTNAME = parsed_args.get('host', 'localhost')
    PORT = find_port(WEBDIFF_CONFIG)

    if parsed_args.get('port') and parsed_args['port'] != -1:
        PORT = parsed_args['port']

    if 'dirs' in parsed_args:
        DIFF = dirdiff.gitdiff(*parsed_args['dirs'], WEBDIFF_CONFIG)
    elif 'files' in parsed_args:
        a_file, b_file = parsed_args['files']
        DIFF = [argparser._shim_for_file_diff(a_file, b_file)]
    else:
        # Git difftool mode
        if len(sys.argv) == 3:
            DIFF = [argparser._shim_for_file_diff(sys.argv[1], sys.argv[2])]
        else:
            DIFF = []

    # Get root_path from config
    root_path = WEBDIFF_CONFIG.get('rootPath', '')

    # Create app with root_path
    app = create_app(root_path)

    logging.basicConfig(format='%(asctime)s %(levelname)-8s %(message)s', level=logging.DEBUG)

    if root_path:
        print(f"Starting webdiff server at http://{HOSTNAME}:{PORT}{root_path}")
    else:
        print(f"Starting webdiff server at http://{HOSTNAME}:{PORT}")

    # Get timeout value from parsed args
    timeout = parsed_args.get('timeout', 0)

    # Create server configuration
    config = uvicorn.Config(
        app,
        host=HOSTNAME,
        port=PORT,
        log_level="info" if DEBUG else "error",
        # Performance optimizations
        limit_concurrency=1000,  # Allow more concurrent connections
        timeout_keep_alive=75,   # Keep connections alive longer
    )
    server = uvicorn.Server(config)

    if timeout > 0:
        print(f"Server will automatically shut down after {timeout} minutes")

        def shutdown_timer():
            time.sleep(timeout * 60)  # Convert minutes to seconds
            print(f"\nTimeout reached ({timeout} minutes). Shutting down server...")
            server.should_exit = True

        # Start the shutdown timer in a daemon thread
        timer_thread = threading.Thread(target=shutdown_timer, daemon=True)
        timer_thread.start()

    # Run server with graceful shutdown handling
    try:
        server.run()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    run()
