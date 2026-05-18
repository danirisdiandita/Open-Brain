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


async def send_invitation_email(
    to_email: str, org_name: str, role: str, token: str, is_registered: bool = False,
) -> None:
    subject = f"You've been invited to {org_name} — Open Brain"
    accept_link = f"{settings.frontend_url}/dashboard/accept-invitation?token={token}"

    if is_registered:
        body = f"""
        <p>You have been invited to join <strong>{org_name}</strong> as a <strong>{role}</strong>.</p>
        <p><a href="{accept_link}">Click here to accept the invitation</a>.</p>
        """
    else:
        register_link = f"{settings.frontend_url}/register?invitation={token}"
        body = f"""
        <p>You have been invited to join <strong>{org_name}</strong> as a <strong>{role}</strong>.</p>
        <p>Create your account to get started:</p>
        <p><a href="{register_link}">Sign up and accept invitation</a></p>
        """

    await send_email(to=to_email, subject=subject, body=body)
