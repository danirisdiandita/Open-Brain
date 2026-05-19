import hashlib
import hmac
import secrets

from app.config import get_settings

_settings = get_settings()


def generate_invitation_token() -> tuple[str, str]:
    raw = secrets.token_urlsafe(32)
    return raw, _compute_hash(raw)


def hash_invitation_token(token: str) -> str:
    return _compute_hash(token)


def verify_invitation_token(token: str, token_hash: str) -> bool:
    return hmac.compare_digest(_compute_hash(token), token_hash)


def _compute_hash(token: str) -> str:
    return hmac.new(
        _settings.secret_key.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()
