import json
import logging
from base64 import b64decode, b64encode
from typing import Awaitable, Callable
from fastapi import Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger(__name__)

class PersistentSessionMiddleware:
    """
    Session middleware that handles cookie storage with improved persistence across redirects.
    Designed specifically to handle OAuth redirects and maintain session state.
    """

    def __init__(
        self,
        app: ASGIApp,
        secret_key: str,
        session_cookie: str = "session",
        max_age: int = 14 * 24 * 60 * 60,  # 14 days, in seconds
        path: str = "/",
        same_site: str = "lax",
        https_only: bool = False,
    ) -> None:
        self.app = app
        self.signer = URLSafeTimedSerializer(secret_key, salt="persistent-session")
        self.session_cookie = session_cookie
        self.max_age = max_age
        self.path = path
        self.security_flags = f"httponly; samesite={same_site}"
        if https_only:
            self.security_flags += "; secure"

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        session_data = {}

        if self.session_cookie in request.cookies:
            cookie_data = request.cookies[self.session_cookie]
            try:
                session_data = self._decode_session(cookie_data)
                logger.debug(f"Successfully decoded session: {list(session_data.keys())}")
            except (BadSignature, SignatureExpired) as e:
                logger.warning(f"Session decode error: {str(e)}")
            except Exception as e:
                logger.error(f"Unexpected session error: {str(e)}")

        logger.debug(f"Session data loaded. Keys: {list(session_data.keys())}")
        
        # Create a copy of scope with session data added
        scope = dict(scope)
        scope["session"] = session_data

        # Override send to intercept the response
        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                if scope["session"]:
                    logger.debug(f"Saving session with keys: {list(scope['session'].keys())}")
                    # Encode session data
                    cookie_value = self._encode_session(scope["session"])
                    
                    # Set cookie in response
                    headers = MutableHeaders(message["headers"])
                    header_value = (
                        f"{self.session_cookie}={cookie_value}; path={self.path}; "
                        f"max-age={self.max_age}; {self.security_flags}"
                    )
                    headers.append(b"set-cookie", header_value.encode("latin-1"))
                    message["headers"] = headers.raw
            
            await send(message)

        await self.app(scope, receive, send_wrapper)

    def _encode_session(self, session_data: dict) -> str:
        """Encode session data to a secure cookie value."""
        json_bytes = json.dumps(session_data).encode("utf-8")
        return self.signer.dumps(b64encode(json_bytes).decode("ascii"))

    def _decode_session(self, cookie_data: str) -> dict:
        """Decode session data from a cookie value."""
        data = self.signer.loads(cookie_data, max_age=self.max_age)
        decoded_bytes = b64decode(data.encode("ascii"))
        return json.loads(decoded_bytes.decode("utf-8")) 