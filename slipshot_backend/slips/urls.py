
from rest_framework.routers import DefaultRouter
from .views import SlipViewSet, TagViewSet, DashboardView, UserRegisterView, UserProfileView, CheckNameView, LeaderboardView
from .cookie_auth import CookieTokenObtainPairView, CheckAuthView
from .cookie_refresh import CookieTokenRefreshView
from .logout import LogoutView
from .change_password import ChangePasswordView
from .admin_views import (
    AdminStatsView, AdminUsersView, AdminToggleUserStatusView, AdminToggleAdminView,
    AdminDeleteUserView, AdminBulkDeleteUsersView, AdminUpdateUserView, AdminCreateUserView
)
from django.urls import path

router = DefaultRouter()
router.register(r'slips', SlipViewSet, basename='slip')
router.register(r'tags', TagViewSet, basename='tag')

urlpatterns = router.urls + [
	path('dashboard/', DashboardView.as_view(), name='dashboard'),
	path('leaderboard/', LeaderboardView.as_view(), name='leaderboard'),
	path('register/', UserRegisterView.as_view(), name='register'),
	path('users/me/', UserProfileView.as_view(), name='user-profile'),
	path('slips/bulk_upload/', SlipViewSet.as_view({'post': 'bulk_upload'}), name='slip-bulk-upload'),
	path('auth/token/cookie/', CookieTokenObtainPairView.as_view(), name='token_obtain_pair_cookie'),
	path('auth/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh_cookie'),
	path('auth/check/', CheckAuthView.as_view(), name='auth-check'),
	path('auth/logout/', LogoutView.as_view(), name='logout'),
	path('auth/change_password/', ChangePasswordView.as_view(), name='change-password'),
	path('auth/check-name/', CheckNameView.as_view(), name='check-name'),
	# Admin endpoints
	path('admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
	path('admin/users/', AdminUsersView.as_view(), name='admin-users'),
	path('admin/users/create/', AdminCreateUserView.as_view(), name='admin-create-user'),
	path('admin/users/bulk-delete/', AdminBulkDeleteUsersView.as_view(), name='admin-bulk-delete-users'),
	path('admin/users/<int:user_id>/', AdminUpdateUserView.as_view(), name='admin-update-user'),
	path('admin/users/<int:user_id>/delete/', AdminDeleteUserView.as_view(), name='admin-delete-user'),
	path('admin/users/<int:user_id>/toggle-status/', AdminToggleUserStatusView.as_view(), name='admin-toggle-user-status'),
	path('admin/users/<int:user_id>/toggle-admin/', AdminToggleAdminView.as_view(), name='admin-toggle-admin'),
]
