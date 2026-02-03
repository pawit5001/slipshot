from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.contrib.auth import authenticate
from django.conf import settings
import os
import logging

# Use Django settings when available so cookie behavior is consistent
# Default to secure and samesite=None when running in non-debug (production)
SECURE_COOKIE = getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG)
SAMESITE_COOKIE = getattr(settings, 'SESSION_COOKIE_SAMESITE', 'None' if not settings.DEBUG else 'Lax')
# Optional domain for cookies (useful if you need a shared parent domain)
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or getattr(settings, 'COOKIE_DOMAIN', None)

logger = logging.getLogger(__name__)

def _safe_cookie_domain(request_host: str, configured_domain: str | None) -> str | None:
    """Return configured_domain only if it appears compatible with request_host.
    Avoid setting a domain attribute that would place the cookie on the wrong origin.
    """
    if not configured_domain:
        return None
    # Normalize
    cd = configured_domain.lstrip('.')
    rh = request_host.split(':')[0]
    # If configured domain equals host or is a parent domain of the host, allow it
    if rh == cd or rh.endswith('.' + cd) or cd.endswith('.' + rh):
        return configured_domain
    logger.warning('COOKIE_DOMAIN (%s) does not match request host (%s) — ignoring domain attribute', configured_domain, request_host)
    return None

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
        # Check if user account is suspended before attempting login
        username = request.data.get('username', '')
        password = request.data.get('password', '')
        
        if username:
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(username=username)
                # Check if password is correct first
                if user.check_password(password):
                    # Password correct, now check if account is active
                    if not user.is_active:
                        return Response({
                            'detail': 'บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ',
                            'code': 'ACCOUNT_SUSPENDED'
                        }, status=status.HTTP_403_FORBIDDEN)
            except User.DoesNotExist:
                pass  # Let the parent handle invalid username
        
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            refresh = response.data.get("refresh")
            access = response.data.get("access")
            cookie_max_age = 30 * 24 * 60 * 60  # 30 days
            
            # Set refresh token as httpOnly cookie
            response.set_cookie(
                key="refresh_token",
                value=refresh,
                max_age=cookie_max_age,
                httponly=True,
                secure=SECURE_COOKIE,
                samesite=SAMESITE_COOKIE,
                path="/",
                domain=_safe_cookie_domain(request.get_host(), COOKIE_DOMAIN),
            )
            # Set access token as httpOnly cookie (shorter expiry)
            response.set_cookie(
                key="access_token",
                value=access,
                max_age=5 * 60,  # 5 minutes
                httponly=True,
                secure=SECURE_COOKIE,
                samesite=SAMESITE_COOKIE,
                path="/",
                domain=_safe_cookie_domain(request.get_host(), COOKIE_DOMAIN),
            )
            # Remove tokens from response body for extra security
            response.data.pop("refresh", None)
            response.data.pop("access", None)
            response.data["authenticated"] = True
        return response


class CheckAuthView(APIView):
    """
    Check if user is authenticated and has valid cookies.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        # Check if access token exists
        access_token = request.COOKIES.get('access_token')
        refresh_token = request.COOKIES.get('refresh_token')
        
        if not access_token and not refresh_token:
            return Response({
                "authenticated": False,
                "detail": "No authentication tokens found"
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        if access_token:
            # Try to validate access token
            from rest_framework_simplejwt.tokens import AccessToken
            try:
                AccessToken(access_token)
                return Response({
                    "authenticated": True,
                    "detail": "Valid access token"
                })
            except Exception:
                pass
        
        if refresh_token:
            # Access token invalid but refresh token exists
            return Response({
                "authenticated": False,
                "refresh_available": True,
                "detail": "Access token expired, refresh token available"
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response({
            "authenticated": False,
            "detail": "Invalid authentication tokens"
        }, status=status.HTTP_401_UNAUTHORIZED)
