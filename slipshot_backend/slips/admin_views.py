from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework import status
from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum, Avg
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from datetime import timedelta
from .models import Slip, Tag


class AdminStatsView(APIView):
    """Get admin statistics with period filter"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        # Period filter: today, week, month, year, all
        period = request.query_params.get('period', 'all')
        
        today = timezone.now().date()
        now = timezone.now()
        
        # Calculate date ranges based on period
        if period == 'today':
            start_date = today
            prev_start = today - timedelta(days=1)
            prev_end = today - timedelta(days=1)
        elif period == 'week':
            start_date = today - timedelta(days=6)
            prev_start = today - timedelta(days=13)
            prev_end = today - timedelta(days=7)
        elif period == 'month':
            start_date = today - timedelta(days=29)
            prev_start = today - timedelta(days=59)
            prev_end = today - timedelta(days=30)
        elif period == 'year':
            start_date = today - timedelta(days=364)
            prev_start = today - timedelta(days=729)
            prev_end = today - timedelta(days=365)
        else:  # all
            start_date = None
            prev_start = None
            prev_end = None
        
        # Base stats (always total)
        total_users = User.objects.count()
        total_slips = Slip.objects.count()
        total_tags = Tag.objects.count()
        
        # Period-filtered stats
        if start_date:
            # Current period
            new_users = User.objects.filter(date_joined__date__gte=start_date).count()
            active_users = User.objects.filter(last_login__date__gte=start_date).count()
            slips_count = Slip.objects.filter(created_at__date__gte=start_date).count()
            income = Slip.objects.filter(type='income', created_at__date__gte=start_date).aggregate(Sum('amount'))['amount__sum'] or 0
            expense = Slip.objects.filter(type='expense', created_at__date__gte=start_date).aggregate(Sum('amount'))['amount__sum'] or 0
            
            # Previous period for comparison
            if prev_start:
                prev_new_users = User.objects.filter(date_joined__date__gte=prev_start, date_joined__date__lte=prev_end).count()
                prev_active_users = User.objects.filter(last_login__date__gte=prev_start, last_login__date__lte=prev_end).count()
                prev_slips = Slip.objects.filter(created_at__date__gte=prev_start, created_at__date__lte=prev_end).count()
                prev_income = Slip.objects.filter(type='income', created_at__date__gte=prev_start, created_at__date__lte=prev_end).aggregate(Sum('amount'))['amount__sum'] or 0
                prev_expense = Slip.objects.filter(type='expense', created_at__date__gte=prev_start, created_at__date__lte=prev_end).aggregate(Sum('amount'))['amount__sum'] or 0
            else:
                prev_new_users = prev_active_users = prev_slips = 0
                prev_income = prev_expense = 0
        else:
            # All time
            new_users = total_users
            active_users = User.objects.filter(last_login__isnull=False).count()
            slips_count = total_slips
            income = Slip.objects.filter(type='income').aggregate(Sum('amount'))['amount__sum'] or 0
            expense = Slip.objects.filter(type='expense').aggregate(Sum('amount'))['amount__sum'] or 0
            prev_new_users = prev_active_users = prev_slips = 0
            prev_income = prev_expense = 0
        
        # Calculate percentage changes
        def calc_change(current, previous):
            if previous == 0:
                return 100 if current > 0 else 0
            return round(((current - previous) / previous) * 100, 1)
        
        # Average slip amount
        avg_slip = Slip.objects.aggregate(Avg('amount'))['amount__avg'] or 0
        
        # Trend data for charts (last 7 or 30 days depending on period)
        if period in ['today', 'week']:
            trend_days = 7
        elif period == 'month':
            trend_days = 30
        else:
            trend_days = 30
        
        trend_start = today - timedelta(days=trend_days - 1)
        
        # Initialize all dates with zero values
        date_map = {}
        for i in range(trend_days):
            d = trend_start + timedelta(days=i)
            date_map[str(d)] = {'date': str(d), 'user_count': 0, 'slip_count': 0, 'income': 0, 'expense': 0}
        
        # Daily user registrations
        user_trend_raw = User.objects.filter(date_joined__date__gte=trend_start) \
            .annotate(trend_date=TruncDate('date_joined')) \
            .values('trend_date') \
            .annotate(count=Count('id'))
        
        for item in user_trend_raw:
            date_str = str(item['trend_date'])
            if date_str in date_map:
                date_map[date_str]['user_count'] = item['count']
        
        # Daily slip counts
        slip_trend_raw = Slip.objects.filter(created_at__date__gte=trend_start) \
            .annotate(trend_date=TruncDate('created_at')) \
            .values('trend_date') \
            .annotate(
                count=Count('id'),
                income=Sum('amount', filter=Q(type='income')),
                expense=Sum('amount', filter=Q(type='expense'))
            )
        
        for item in slip_trend_raw:
            date_str = str(item['trend_date'])
            if date_str in date_map:
                date_map[date_str]['slip_count'] = item['count']
                date_map[date_str]['income'] = float(item['income'] or 0)
                date_map[date_str]['expense'] = float(item['expense'] or 0)
        
        # Convert to sorted lists
        sorted_dates = sorted(date_map.keys())
        user_trend = [{'date': d, 'count': date_map[d]['user_count']} for d in sorted_dates]
        slip_trend = [{'date': d, 'count': date_map[d]['slip_count'], 'income': date_map[d]['income'], 'expense': date_map[d]['expense']} for d in sorted_dates]
        
        # Top users by slip count
        top_users_raw = User.objects.annotate(
            slip_count=Count('slips'),
            total_amount=Sum('slips__amount')
        ).filter(slip_count__gt=0).order_by('-slip_count')[:5].values(
            'id', 'username', 'first_name', 'last_name', 'slip_count', 'total_amount'
        )
        top_users = [{
            'id': u['id'],
            'username': u['username'],
            'first_name': u['first_name'],
            'last_name': u['last_name'],
            'slip_count': u['slip_count'],
            'total_amount': float(u['total_amount'] or 0)
        } for u in top_users_raw]
        
        # Recent users (latest registered)
        recent_users_queryset = User.objects.order_by('-date_joined')[:5]
        recent_users = [{
            'id': u.id,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'date_joined': u.date_joined.strftime('%Y-%m-%d %H:%M'),
            'is_active': u.is_active,
            'is_staff': u.is_staff,
        } for u in recent_users_queryset]
        
        stats = {
            # Totals
            'total_users': total_users,
            'total_slips': total_slips,
            'total_tags': total_tags,
            
            # Period stats
            'new_users': new_users,
            'active_users': active_users,
            'slips_count': slips_count,
            'income': float(income),
            'expense': float(expense),
            'net': float(income - expense),
            'avg_slip': float(avg_slip),
            
            # Changes (%)
            'new_users_change': calc_change(new_users, prev_new_users),
            'active_users_change': calc_change(active_users, prev_active_users),
            'slips_change': calc_change(slips_count, prev_slips),
            'income_change': calc_change(income, prev_income),
            'expense_change': calc_change(expense, prev_expense),
            
            # Trends
            'user_trend': user_trend,
            'slip_trend': slip_trend,
            
            # Top users
            'top_users': top_users,
            
            # Recent users
            'recent_users': recent_users,
            
            # Period info
            'period': period,
        }
        return Response(stats)


class AdminUsersView(APIView):
    """List all users for admin with pagination, search, and sorting"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        # Pagination parameters
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 10))
        search = request.query_params.get('search', '').strip()
        sort_by = request.query_params.get('sort_by', '-date_joined')
        
        # Base queryset with annotation
        queryset = User.objects.all().annotate(
            slip_count=Count('slips')
        )
        
        # Search filter
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )
        
        # Sorting
        valid_sort_fields = ['username', 'email', 'date_joined', 'last_login', 'first_name', 'last_name', 'slip_count',
                             '-username', '-email', '-date_joined', '-last_login', '-first_name', '-last_name', '-slip_count']
        if sort_by in valid_sort_fields:
            queryset = queryset.order_by(sort_by)
        else:
            queryset = queryset.order_by('-date_joined')
        
        # Total count before pagination
        total_count = queryset.count()
        total_pages = (total_count + page_size - 1) // page_size
        
        # Pagination
        start = (page - 1) * page_size
        end = start + page_size
        users = queryset[start:end]
        
        data = [{
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_staff': user.is_staff,
            'is_active': user.is_active,
            'date_joined': user.date_joined.isoformat(),
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'slip_count': user.slip_count,
        } for user in users]
        
        return Response({
            'users': data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1,
            }
        })


class AdminToggleUserStatusView(APIView):
    """Toggle user active status"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            is_active = request.data.get('is_active', not user.is_active)
            user.is_active = is_active
            user.save(update_fields=['is_active'])
            return Response({'success': True, 'is_active': user.is_active})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class AdminToggleAdminView(APIView):
    """Toggle user admin status"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            # Prevent removing own admin status
            if user.id == request.user.id:
                return Response({'error': 'Cannot change own admin status'}, status=status.HTTP_400_BAD_REQUEST)
            
            is_staff = request.data.get('is_staff', not user.is_staff)
            user.is_staff = is_staff
            user.save(update_fields=['is_staff'])
            return Response({'success': True, 'is_staff': user.is_staff})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class AdminDeleteUserView(APIView):
    """Delete a user"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def delete(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            # Prevent deleting self
            if user.id == request.user.id:
                return Response({'error': 'Cannot delete yourself'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if this is the last admin
            if user.is_staff:
                admin_count = User.objects.filter(is_staff=True).count()
                if admin_count <= 1:
                    return Response({'error': 'Cannot delete the last admin'}, status=status.HTTP_400_BAD_REQUEST)
            
            username = user.username
            user.delete()
            return Response({'success': True, 'message': f'User {username} deleted'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class AdminBulkDeleteUsersView(APIView):
    """Delete multiple users"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        user_ids = request.data.get('user_ids', [])
        if not user_ids:
            return Response({'error': 'No user IDs provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Filter out self
        user_ids = [uid for uid in user_ids if uid != request.user.id]
        
        # Get users to delete
        users = User.objects.filter(id__in=user_ids)
        
        # Check if deleting all admins
        admin_ids = list(users.filter(is_staff=True).values_list('id', flat=True))
        remaining_admins = User.objects.filter(is_staff=True).exclude(id__in=admin_ids).count()
        
        if len(admin_ids) > 0 and remaining_admins == 0:
            return Response({'error': 'Cannot delete all admins'}, status=status.HTTP_400_BAD_REQUEST)
        
        deleted_count = users.count()
        users.delete()
        
        return Response({
            'success': True,
            'deleted_count': deleted_count,
        })


class AdminUpdateUserView(APIView):
    """Update user details"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def put(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            
            # Update allowed fields
            if 'first_name' in request.data:
                user.first_name = request.data['first_name']
            if 'last_name' in request.data:
                user.last_name = request.data['last_name']
            if 'email' in request.data:
                user.email = request.data['email']
            if 'username' in request.data and request.data['username'] != user.username:
                # Check if username is taken
                if User.objects.filter(username=request.data['username']).exclude(id=user_id).exists():
                    return Response({'error': 'Username already taken'}, status=status.HTTP_400_BAD_REQUEST)
                user.username = request.data['username']
            
            user.save()
            
            return Response({
                'success': True,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'is_staff': user.is_staff,
                    'is_active': user.is_active,
                }
            })
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class AdminCreateUserView(APIView):
    """Create a new user"""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        is_staff = request.data.get('is_staff', False)
        
        # Validation
        if not username:
            return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not password:
            return Response({'error': 'Password is required'}, status=status.HTTP_400_BAD_REQUEST)
        if len(password) < 6:
            return Response({'error': 'Password must be at least 6 characters'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if username exists
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if email exists (if provided)
        if email and User.objects.filter(email=email).exists():
            return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create user
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        user.is_staff = is_staff
        user.save()
        
        # Create default tag for user
        Tag.objects.create(user=user, name='ไม่ระบุ')
        
        return Response({
            'success': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_active': user.is_active,
                'date_joined': user.date_joined.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)
