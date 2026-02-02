
from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Slip, Tag

# Default tags ที่จะสร้างให้ user ใหม่อัตโนมัติ
DEFAULT_TAGS = [
    'ไม่ระบุ',  # Default category
    'อาหาร',
    'เดินทาง',
    'ช้อปปิ้ง',
    'บิล/ค่าใช้จ่าย',
    'สุขภาพ',
    'บันเทิง',
    'การศึกษา',
    'เงินเดือน',
    'รายได้พิเศษ',
    'โอนเงิน',
    'อื่นๆ',
]

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'first_name', 'last_name']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        # สร้าง default tags ให้ user ใหม่
        for tag_name in DEFAULT_TAGS:
            Tag.objects.create(user=user, name=tag_name)
        return user

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class SlipSerializer(serializers.ModelSerializer):
    tag = TagSerializer(read_only=True)
    tag_id = serializers.PrimaryKeyRelatedField(queryset=Tag.objects.all(), source='tag', write_only=True, required=False, allow_null=True)
    image = serializers.ImageField(required=False, allow_null=True)
    time = serializers.TimeField(required=False, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default='')
    account_name = serializers.CharField(required=False, allow_blank=True, default='ไม่ระบุ')

    class Meta:
        model = Slip
        fields = ['id', 'account_name', 'amount', 'date', 'time', 'note', 'image', 'tag', 'tag_id', 'type', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

