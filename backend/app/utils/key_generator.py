import secrets
import base64
from typing import Tuple

def generate_secure_key() -> str:
    """
    Generate a cryptographically secure key suitable for JWT signing.
    Returns a base64-encoded string of 32 random bytes.
    """
    # Generate 32 random bytes
    random_bytes = secrets.token_bytes(32)
    # Encode to base64 for easy storage and use
    return base64.b64encode(random_bytes).decode('utf-8')

def generate_key_pair() -> Tuple[str, str]:
    """
    Generate a pair of keys - one for access tokens and one for refresh tokens.
    Returns a tuple of (access_key, refresh_key).
    """
    access_key = generate_secure_key()
    refresh_key = generate_secure_key()
    return access_key, refresh_key

if __name__ == "__main__":
    # This can be run directly to generate new keys
    access_key, refresh_key = generate_key_pair()
    print("Access Token Key:", access_key)
    print("Refresh Token Key:", refresh_key) 