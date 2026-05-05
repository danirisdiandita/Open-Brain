import asyncio
import logging

import resend

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

resend.api_key = settings.resend_api_key


async def send_email(to: str, subject: str, body: str) -> None:
    try:
        params: resend.Emails.SendParams = {
            "from": settings.resend_from,
            "to": [to],
            "subject": subject,
            "html": body,
        }
        await asyncio.to_thread(resend.Emails.send, params)
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", to, exc)
        if settings.debug:
            logger.info("Email body: %s", body)


async def send_verification_email(to_email: str, token: str) -> None:
    link = f"{settings.verify_email_redirect}?token={token}"
    await send_email(
        to=to_email,
        subject="Verify your email — Open Brain",
        body=f'<p>Click <a href="{link}">here</a> to verify your email address.</p>',
    )


async def send_password_reset_email(to_email: str, token: str) -> None:
    link = f"{settings.reset_password_redirect}?token={token}"
    await send_email(
        to=to_email,
        subject="Reset your password — Open Brain",
        body=f'<p>Click <a href="{link}">here</a> to reset your password. This link expires in 1 hour.</p>',
    )
