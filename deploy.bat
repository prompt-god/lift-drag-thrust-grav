@echo off
setlocal enabledelayedexpansion

rem Configure these or set env vars before running
if "%S3_BUCKET%"=="" (
  echo S3_BUCKET not set. Set S3_BUCKET or pass --bucket.
)

rem Optional: S3 prefix (default: lift-drag-thrust-grav/)
if "%S3_PREFIX%"=="" (
  set S3_PREFIX=lift-drag-thrust-grav/
)

rem Optional: CloudFront distribution ID for invalidation
if "%CLOUDFRONT_DIST_ID%"=="" (
  set CLOUDFRONT_DIST_ID=
)

python deploy.py --bucket "%S3_BUCKET%" --prefix "%S3_PREFIX%" --dist-id "%CLOUDFRONT_DIST_ID%"
if %errorlevel% neq 0 (
  echo Deployment failed.
  exit /b %errorlevel%
)

echo Done.
endlocal
