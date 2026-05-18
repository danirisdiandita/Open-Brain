"""S3-compatible object storage via boto3 (MinIO, AWS S3, etc.)."""

import uuid

import boto3
from botocore.config import Config

from app.config import get_settings


def _bucket() -> str:
    return get_settings().s3_bucket


def _get_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name=settings.s3_region,
    )


def _ensure_bucket():
    client = _get_client()
    try:
        client.head_bucket(Bucket=_bucket())
    except Exception:
        client.create_bucket(Bucket=_bucket())


async def upload_file(content: bytes, filename: str, content_type: str | None = None) -> dict:
    _ensure_bucket()
    client = _get_client()
    key = f"{uuid.uuid4().hex}/{filename}"

    extra_args = {}
    if content_type:
        extra_args["ContentType"] = content_type

    client.put_object(
        Bucket=_bucket(),

        Key=key,
        Body=content,
        **extra_args,
    )

    return {
        "s3_key": key,
        "size": len(content),
    }


async def get_presigned_url(s3_key: str, expires: int = 3600) -> str:
    client = _get_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket(), "Key": s3_key},
        ExpiresIn=expires,
    )


async def delete_file(s3_key: str) -> None:
    client = _get_client()
    client.delete_object(Bucket=_bucket(), Key=s3_key)
