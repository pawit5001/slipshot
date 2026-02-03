from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny


class DebugCookieView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        # Return parsed cookies and raw HTTP_COOKIE header for debugging
        cookies = request.COOKIES
        raw_cookie = request.META.get('HTTP_COOKIE')
        return Response({
            'cookies': cookies,
            'raw_cookie_header': raw_cookie,
        })
