import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.services.invitation import InvitationError, accept_invitation
from app.utils.email import send_password_reset_email, send_verification_email
from app.utils.security import (
    create_token,
    generate_verification_token,
    hash_password,
    verify_password,
)


class AuthError(Exception):
    pass


async def register_user(
    db: AsyncSession,
    email: str,
    password: str,
    full_name: str = "",
    invitation: str | None = None,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none() is not None:
        raise AuthError("A user with this email already exists")

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        verification_token=generate_verification_token(),
        verification_token_expires=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(user)
    await db.flush()

    if invitation:
        try:
            await accept_invitation(db, invitation, user)
        except InvitationError:
            # We ignore invitation errors during registration so a user can always register 
            # (they'll just be a free user instead of an org member)
            pass 

    await send_verification_email(user.email, user.verification_token)

    return user


async def login_user(
    db: AsyncSession,
    email: str,
    password: str,
) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise AuthError("Invalid email or password")

    if not user.is_active:
        raise AuthError("Account is deactivated")

    return {
        "access_token": create_token(user.id, "access"),
        "refresh_token": create_token(user.id, "refresh"),
        "token_type": "bearer",
    }


async def refresh_access_token(
    db: AsyncSession,
    refresh_token: str,
) -> dict:
    from jose import JWTError

    from app.utils.security import decode_token

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise AuthError("Invalid refresh token")

    if payload.get("type") != "refresh":
        raise AuthError("Invalid token type")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise AuthError("User not found or inactive")

    return {
        "access_token": create_token(user.id, "access"),
        "refresh_token": create_token(user.id, "refresh"),
        "token_type": "bearer",
    }


async def verify_email(db: AsyncSession, token: str) -> None:
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthError("Invalid verification token")

    if user.verification_token_expires and user.verification_token_expires < datetime.now(timezone.utc):
        raise AuthError("Verification token has expired")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None


async def resend_verification(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        return

    if user.is_verified:
        return

    user.verification_token = generate_verification_token()
    user.verification_token_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.flush()

    await send_verification_email(user.email, user.verification_token)


async def forgot_password(db: AsyncSession, email: str) -> None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        return

    user.password_reset_token = generate_verification_token()
    user.password_reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.flush()

    await send_password_reset_email(user.email, user.password_reset_token)


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    result = await db.execute(select(User).where(User.password_reset_token == token))
    user = result.scalar_one_or_none()

    if user is None:
        raise AuthError("Invalid reset token")

    if user.password_reset_token_expires and user.password_reset_token_expires < datetime.now(timezone.utc):
        raise AuthError("Reset token has expired")

    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_token_expires = None
