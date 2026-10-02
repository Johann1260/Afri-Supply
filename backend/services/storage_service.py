"""
storage_service.py — Upload d'images avec CDN S3 (Cloudflare R2 compatible) + fallback local.

Logique :
- Si AWS_ACCESS_KEY_ID + S3_BUCKET configurés → upload S3, retourne URL CDN
- Sinon → sauvegarde locale dans uploads/products/, retourne URL relative /uploads/products/xxx
- Compatibilité Cloudflare R2 : endpoint_url optionnel (R2 = S3-compatible)
"""
import logging
from pathlib import Path
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_DOC_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_SIZE = 5 * 1024 * 1024   # 5 Mo
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 Mo

DOCS_DIR = Path("uploads/documents")
DOCS_DIR.mkdir(parents=True, exist_ok=True)


def _get_s3_client():
    """Lazy init boto3 client — ne s'instancie que si S3 est configuré."""
    import boto3
    kwargs = dict(
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )
    # Cloudflare R2 ou tout endpoint S3-compatible
    if settings.cdn_url and "r2.cloudflarestorage" in settings.cdn_url:
        account_id = settings.cdn_url.split(".")[0].replace("https://", "")
        kwargs["endpoint_url"] = f"https://{account_id}.r2.cloudflarestorage.com"
    return boto3.client("s3", **kwargs)


async def upload_image(content: bytes, filename: str, folder: str = "products") -> str:
    """
    Upload une image et retourne l'URL publique.
    - content   : bytes de l'image
    - filename  : nom de fichier avec extension (ex: uuid4.jpg)
    - folder    : sous-dossier S3 ou local (default: 'products')
    Retourne : URL absolue (CDN) ou relative (/uploads/products/xxx)
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extension non supportée: {ext}")
    if len(content) > MAX_SIZE:
        raise ValueError(f"Image trop volumineuse (max 5 Mo)")

    if settings.s3_enabled:
        return await _upload_to_s3(content, filename, folder, ext)
    return _upload_local(content, filename)


async def _upload_to_s3(content: bytes, filename: str, folder: str, ext: str) -> str:
    import asyncio
    key = f"{folder}/{filename}"
    content_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    }
    ct = content_type_map.get(ext, "application/octet-stream")
    try:
        client = _get_s3_client()
        # Run in thread pool — boto3 n'est pas async
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: client.put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=content,
            ContentType=ct,
            CacheControl="public, max-age=31536000, immutable",
        ))
        base = settings.cdn_url.rstrip("/") if settings.cdn_url else f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com"
        return f"{base}/{key}"
    except Exception as e:
        logger.error(f"S3 upload failed ({e}) — fallback to local storage")
        return _upload_local(content, filename)


def _upload_local(content: bytes, filename: str) -> str:
    path = UPLOAD_DIR / filename
    path.write_bytes(content)
    return f"/uploads/products/{filename}"


async def upload_document(content: bytes, filename: str) -> str:
    """
    Upload un document (PDF ou image) dans le dossier 'docs'.
    Retourne l'URL publique (CDN) ou relative (/uploads/documents/xxx).
    Max 10 Mo. Extensions: .pdf, .jpg, .jpeg, .png.
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise ValueError(f"Extension non supportée pour les documents: {ext}")
    if len(content) > MAX_DOC_SIZE:
        raise ValueError("Document trop volumineux (max 10 Mo)")

    if settings.s3_enabled:
        ct_map = {".pdf": "application/pdf", ".jpg": "image/jpeg",
                  ".jpeg": "image/jpeg", ".png": "image/png"}
        ct = ct_map.get(ext, "application/octet-stream")
        key = f"docs/{filename}"
        try:
            import asyncio as _asyncio
            client = _get_s3_client()
            loop = _asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: client.put_object(
                Bucket=settings.s3_bucket, Key=key, Body=content,
                ContentType=ct, CacheControl="private, max-age=86400",
            ))
            base = settings.cdn_url.rstrip("/") if settings.cdn_url else \
                f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com"
            return f"{base}/{key}"
        except Exception as e:
            logger.error(f"S3 doc upload failed ({e}) — fallback local")

    path = DOCS_DIR / filename
    path.write_bytes(content)
    return f"/uploads/documents/{filename}"
