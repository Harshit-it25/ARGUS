"""Shared rate limiter instance, kept in its own module to avoid circular imports
between main.py (which registers it on the app) and route modules (which use it
as a decorator)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
