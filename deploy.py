import boto3
import os
from pathlib import Path
import mimetypes
import argparse
import time

mimetypes.init()

DEFAULT_CLOUDFRONT_DIST_ID = os.environ.get('CLOUDFRONT_DIST_ID', '')
DEFAULT_BUCKET = os.environ.get('S3_BUCKET', '')
DEFAULT_PREFIX = os.environ.get('S3_PREFIX', 'lift-drag-thrust-grav/')  # default deploy path

if not mimetypes.guess_type('test.js')[0]:
    mimetypes.add_type('application/javascript', '.js')

def log(message: str) -> None:
    print(f"DEPLOY: {message}")

def upload_file(local_path: str, bucket: str, key: str) -> bool:
    s3 = boto3.client('s3')
    content_type, _ = mimetypes.guess_type(local_path)
    if not content_type:
        ext = os.path.splitext(local_path)[1].lower()
        content_type = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.mp3': 'audio/mpeg',
        }.get(ext, 'application/octet-stream')

    extra_args = {
        'ContentType': content_type,
        'Expires': '-1',
    }

    try:
        s3.upload_file(local_path, bucket, key, ExtraArgs=extra_args)
        log(f"Uploaded {local_path} -> s3://{bucket}/{key} ({content_type})")
        return True
    except Exception as e:
        log(f"ERROR uploading {local_path}: {e}")
        return False

def deploy(public_dir: str, bucket: str, prefix: str) -> tuple[int, int]:
    base = Path(public_dir)
    uploaded = 0
    errors = 0
    for root, _, files in os.walk(base):
        for filename in files:
            if filename.startswith('.'):
                continue
            local_path = os.path.join(root, filename)
            rel = os.path.relpath(local_path, str(base)).replace(os.path.sep, '/')
            key = f"{prefix}{rel}" if prefix else rel
            if upload_file(local_path, bucket, key):
                uploaded += 1
            else:
                errors += 1
    log(f"Upload complete: {uploaded} ok, {errors} errors")
    return uploaded, errors

def invalidate(distribution_id: str, paths: list[str]) -> None:
    if not distribution_id:
        log("No CloudFront distribution ID provided; skipping invalidation")
        return
    cf = boto3.client('cloudfront')
    batch = {
        'Paths': {
            'Quantity': len(paths),
            'Items': paths,
        },
        'CallerReference': str(int(time.time()))
    }
    try:
        inv = cf.create_invalidation(DistributionId=distribution_id, InvalidationBatch=batch)
        log(f"Created invalidation {inv.get('Invalidation', {}).get('Id')}: {', '.join(paths)}")
    except Exception as e:
        log(f"ERROR creating invalidation: {e}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Deploy public/ to S3 and invalidate CloudFront')
    parser.add_argument('--bucket', default=DEFAULT_BUCKET, help='S3 bucket name (env S3_BUCKET)')
    parser.add_argument('--prefix', default=DEFAULT_PREFIX, help='S3 key prefix (default: lift-drag-thrust-grav/)')
    parser.add_argument('--dir', default='public', help='Local directory to upload (default: public)')
    parser.add_argument('--dist-id', default=DEFAULT_CLOUDFRONT_DIST_ID, help='CloudFront distribution ID (env CLOUDFRONT_DIST_ID)')
    parser.add_argument('--skip-invalidate', action='store_true', help='Skip CloudFront invalidation')
    args = parser.parse_args()

    if not args.bucket:
        raise SystemExit('Missing S3 bucket. Provide --bucket or set S3_BUCKET env var.')

    deploy(args.dir, args.bucket, args.prefix)

    if not args.skip_invalidate:
        invalidate(args.dist_id, ['/*'])


