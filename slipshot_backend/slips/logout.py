from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
import os

# Check if running in production (HTTPS)
IS_PRODUCTION = os.environ.get('DJANGO_DEBUG', 'True').lower() != 'true'
SAMESITE_COOKIE = 'None' if IS_PRODUCTION else 'Lax'


class LogoutView(APIView):
    """
    Logout endpoint that clears all auth cookies and blacklists the refresh token.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        response = Response({"detail": "Successfully logged out"}, status=status.HTTP_200_OK)
        
        # Try to blacklist the refresh token (if blacklist is enabled)
        refresh_token = request.COOKIES.get('refresh_token')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                # Blacklist might not be enabled or token is invalid - continue anyway
                pass
        
        # Clear all auth cookies with proper attributes
        response.delete_cookie(
            key="access_token",
            path="/",
            samesite=SAMESITE_COOKIE,
        )
        response.delete_cookie(
            key="refresh_token",
            path="/",
            samesite=SAMESITE_COOKIE,
        )
        
        return response
