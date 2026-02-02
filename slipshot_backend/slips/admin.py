from django.contrib import admin
from .models import Slip, Tag

@admin.register(Slip)
class SlipAdmin(admin.ModelAdmin):
	list_display = ('account_name', 'amount', 'date', 'type', 'user', 'created_at')
	list_filter = ('type', 'date', 'user')
	search_fields = ('account_name', 'user__username')

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
	list_display = ('name', 'user')
	search_fields = ('name', 'user__username')

