from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
import os

# Check if running in production (HTTPS)
IS_PRODUCTION = os.environ.get('DJANGO_DEBUG', 'True').lower() != 'true'
SECURE_COOKIE = IS_PRODUCTION
# SameSite=None required for cross-origin cookies (Vercel -> Render)
SAMESITE_COOKIE = 'None' if IS_PRODUCTION else 'Lax'


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
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            refresh = RefreshToken(refresh_token)
            access_token = str(refresh.access_token)
            
            response = Response({
                'detail': 'Token refreshed',
                'authenticated': True
            })
            
            # Set new access token
            response.set_cookie(
                key='access_token',
                value=access_token,
                max_age=5 * 60,  # 5 minutes
                httponly=True,
                secure=SECURE_COOKIE,
                samesite=SAMESITE_COOKIE,
                path='/',
            )
            
            # Rotate refresh token for better security (optional but recommended)
            # This invalidates the old refresh token
            if getattr(settings, 'SIMPLE_JWT', {}).get('ROTATE_REFRESH_TOKENS', False):
                try:
                    # Blacklist the old refresh token
                    refresh.blacklist()
                except Exception:
                    pass
                
                # Generate new refresh token
                new_refresh = str(RefreshToken.for_user(refresh.payload.get('user_id')))
                response.set_cookie(
                    key='refresh_token',
                    value=new_refresh,
                    max_age=30 * 24 * 60 * 60,  # 30 days
                    httponly=True,
                    secure=SECURE_COOKIE,
                    samesite=SAMESITE_COOKIE,
                    path='/',
                )
            
            return response
            
        except Exception as e:
            error_msg = str(e)
            if 'expired' in error_msg.lower():
                return Response(
                    {'error': 'Refresh token has expired', 'code': 'REFRESH_TOKEN_EXPIRED'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            elif 'blacklisted' in error_msg.lower():
                return Response(
                    {'error': 'Refresh token has been revoked', 'code': 'REFRESH_TOKEN_REVOKED'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            return Response(
                {'error': 'Invalid refresh token', 'code': 'REFRESH_TOKEN_INVALID'},
                status=status.HTTP_401_UNAUTHORIZED
            )


# Import settings for ROTATE_REFRESH_TOKENS check
from django.conf import settings
