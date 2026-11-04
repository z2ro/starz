"""Opaque, revocable database sessions and salted slow password hashes."""
import hashlib
import hmac
import secrets
from contextvars import ContextVar

current_empire = ContextVar('current_empire', default=None)
COOKIE = 'starz_universe_session'
SESSION_SECONDS = 7 * 86400


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
    return f'pbkdf2_sha256${salt}${value}'


def verify_password(password, encoded):
    return hmac.compare_digest(password_hash(password, encoded.split('$')[1]), encoded)


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()
