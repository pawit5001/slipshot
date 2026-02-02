from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.conf import settings
from datetime import timedelta
import os

# Check if running in production (HTTPS)
IS_PRODUCTION = os.environ.get('DJANGO_ENV', 'development') == 'production'
SECURE_COOKIE = IS_PRODUCTION

class CookieTokenObtainPairView(TokenObtainPairView):
    def post(self, request, *args, **kwargs):
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
                samesite="Lax",
                path="/",
            )
            # Set access token as httpOnly cookie (shorter expiry)
            response.set_cookie(
                key="access_token",
                value=access,
                max_age=5 * 60,  # 5 minutes
                httponly=True,
                secure=SECURE_COOKIE,
                samesite="Lax",
                path="/",
            )
            # Remove tokens from response body for extra security
            response.data.pop("refresh", None)
            response.data.pop("access", None)
            response.data["authenticated"] = True
        return response


class CookieLogoutView(APIView):
    """
    Logout endpoint that clears all auth cookies and optionally blacklists the refresh token.
    """
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        response = Response({"detail": "Successfully logged out"})
        
        # Try to blacklist the refresh token (if blacklist is enabled)
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                # Blacklist might not be enabled or token is invalid
                pass
        
        # Clear all auth cookies
        response.delete_cookie(
            key="access_token",
            path="/",
            samesite="Lax",
        )
        response.delete_cookie(
            key="refresh_token",
            path="/",
            samesite="Lax",
        )
        
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
