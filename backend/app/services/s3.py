import asyncio
import uuid

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import get_settings


class S3StorageError(Exception):
    pass


def _get_s3_client():
    settings = get_settings()
    kwargs: dict = {
        "service_name": "s3",
        "aws_access_key_id": settings.s3_access_key,
        "aws_secret_access_key": settings.s3_secret_key,
        "region_name": settings.s3_region,
        "config": BotoConfig(
            signature_version="s3v4",
            s3={"addressing_style": "path"} if settings.s3_use_path_style else {},
        ),
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client(**kwargs)


async def upload_file(
    file_data: bytes,
    filename: str,
    content_type: str,
    org_id: uuid.UUID,
    note_id: uuid.UUID,
) -> str:
    settings = get_settings()
    key = f"notes/{org_id}/{note_id}/{filename}"
    client = await asyncio.to_thread(_get_s3_client)

    # Ensure bucket exists
    try:
        await asyncio.to_thread(client.head_bucket, Bucket=settings.s3_bucket)
    except Exception:
        await asyncio.to_thread(client.create_bucket, Bucket=settings.s3_bucket)

    try:
        await asyncio.to_thread(
            client.put_object,
            Bucket=settings.s3_bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type,
        )
    except ClientError as exc:
        raise S3StorageError(f"Failed to upload to S3: {exc}") from exc

    return key


async def delete_file(key: str) -> None:
    if not key:
        return
    settings = get_settings()
    client = await asyncio.to_thread(_get_s3_client)

    try:
        await asyncio.to_thread(
            client.delete_object,
            Bucket=settings.s3_bucket,
            Key=key,
        )
    except ClientError:
        pass


async def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    settings = get_settings()
    client = await asyncio.to_thread(_get_s3_client)

    if settings.s3_public_url:
        return f"{settings.s3_public_url.rstrip('/')}/{key}"

    url = await asyncio.to_thread(
        client.generate_presigned_url,
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": key},
        ExpiresIn=expires_in,
    )
    return url
