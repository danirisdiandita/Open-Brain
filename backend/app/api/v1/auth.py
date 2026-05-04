from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services.auth import (
    AuthError,
    forgot_password,
    login_user,
    refresh_access_token,
    register_user,
    resend_verification,
    reset_password,
    verify_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await register_user(db, body.email, body.password, body.full_name)
        return {"message": "Registration successful. Please check your email to verify your account.", "user_id": str(user.id)}
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await login_user(db, body.email, body.password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


@router.post("/refresh", response_model=LoginResponse)
async def refresh(body: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await refresh_access_token(db, body.refresh_token)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


@router.post("/verify-email")
async def verify_email_endpoint(body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    try:
        await verify_email(db, body.token)
        return {"message": "Email verified successfully"}
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/resend-verification")
async def resend_verification_endpoint(body: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    await resend_verification(db, body.email)
    return {"message": "If the email exists and is not verified, a new verification email has been sent"}


@router.post("/forgot-password")
async def forgot_password_endpoint(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    await forgot_password(db, body.email)
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/reset-password")
async def reset_password_endpoint(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    try:
        await reset_password(db, body.token, body.new_password)
        return {"message": "Password reset successful"}
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
