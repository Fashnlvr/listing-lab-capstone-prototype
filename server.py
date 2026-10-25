"""Local static site and research API. The API key stays in server memory."""
import getpass
import os
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
from api.market_research import handler as ResearchHandler

ROOT = Path(__file__).resolve().parent


class LocalHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if urlparse(self.path).path == "/api/market_research":
            return ResearchHandler.do_POST(self)
        self.send_error(404)

    reply = ResearchHandler.reply

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        parts = Path(path).parts
        if any(part.startswith(".") for part in parts) or path.startswith(("/api/", "/tests/")) or path.endswith(".py"):
            return self.send_error(404)
        if path.endswith("/") and path != "/":
            return self.send_error(404)
        return super().do_HEAD() if self.command == "HEAD" else super().do_GET()

    do_HEAD = do_GET


if __name__ == "__main__":
    if not os.environ.get("SERPAPI_KEY"):
        os.environ["SERPAPI_KEY"] = getpass.getpass("SerpApi key (hidden; press Enter to skip live search): ").strip()
    print("Listing Lab: http://127.0.0.1:8000/new-listing.html")
    ThreadingHTTPServer(("127.0.0.1", 8000), partial(LocalHandler, directory=str(ROOT))).serve_forever()
