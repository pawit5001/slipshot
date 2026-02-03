from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.conf import settings
import os

# Use Django settings when available so cookie behavior is consistent
import logging

SECURE_COOKIE = getattr(settings, 'SESSION_COOKIE_SECURE', not settings.DEBUG)
SAMESITE_COOKIE = getattr(settings, 'SESSION_COOKIE_SAMESITE', 'None' if not settings.DEBUG else 'Lax')
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or getattr(settings, 'COOKIE_DOMAIN', None)

logger = logging.getLogger(__name__)


def _safe_cookie_domain(request_host: str, configured_domain: str | None) -> str | None:
    if not configured_domain:
        return None
    cd = configured_domain.lstrip('.')
    rh = request_host.split(':')[0]
    if rh == cd or rh.endswith('.' + cd) or cd.endswith('.' + rh):
        return configured_domain
    logger.warning('COOKIE_DOMAIN (%s) does not match request host (%s) — ignoring domain attribute', configured_domain, request_host)
    return None


class CookieTokenRefreshView(APIView):
    """
    Refresh access token using refresh_token from httpOnly cookie.
    Also rotates the refresh token for better security.
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')

        if not refresh_token:
            return Response(
                {'error': 'Refresh token not found', 'code': 'REFRESH_TOKEN_MISSING'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)

            response = Response({
                'detail': 'Token refreshed',
                'authenticated': True,
            })

            # Set new access token cookie
            response.set_cookie(
                key='access_token',
                value=access_token,
                max_age=5 * 60,  # 5 minutes
                httponly=True,
                secure=SECURE_COOKIE,
                samesite=SAMESITE_COOKIE,
                path='/',
                domain=_safe_cookie_domain(request.get_host(), COOKIE_DOMAIN),
            )

            # Optionally rotate refresh token
            if getattr(settings, 'SIMPLE_JWT', {}).get('ROTATE_REFRESH_TOKENS', False):
                try:
                    # Blacklist the old refresh token if blacklist app enabled
                    refresh.blacklist()
                except Exception:
                    pass

                # Try to create a new refresh token for the same user
                user_id = refresh.payload.get('user_id') or refresh.payload.get('user')
                new_refresh_value = None
                if user_id:
                    try:
                        from django.contrib.auth import get_user_model

                        User = get_user_model()
                        user = User.objects.filter(pk=user_id).first()
                        if user:
                            new_refresh = RefreshToken.for_user(user)
                            new_refresh_value = str(new_refresh)
                    except Exception:
                        new_refresh_value = None

                if new_refresh_value:
                    response.set_cookie(
                        key='refresh_token',
                        value=new_refresh_value,
                        max_age=30 * 24 * 60 * 60,  # 30 days
                        httponly=True,
                        secure=SECURE_COOKIE,
                        samesite=SAMESITE_COOKIE,
                        path='/',
                        domain=_safe_cookie_domain(request.get_host(), COOKIE_DOMAIN),
                    )

            return response

        except Exception as e:
            error_msg = str(e)
            if 'expired' in error_msg.lower():
                return Response(
                    {'error': 'Refresh token has expired', 'code': 'REFRESH_TOKEN_EXPIRED'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if 'blacklist' in error_msg.lower() or 'blacklisted' in error_msg.lower():
                return Response(
                    {'error': 'Refresh token has been revoked', 'code': 'REFRESH_TOKEN_REVOKED'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            return Response(
                {'error': 'Invalid refresh token', 'code': 'REFRESH_TOKEN_INVALID'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
