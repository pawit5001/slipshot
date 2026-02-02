from django.db import models
from django.contrib.auth.models import User

class Tag(models.Model):
	name = models.CharField(max_length=50)
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tags')

	def __str__(self):
		return self.name
	
	class Meta:
		unique_together = ['name', 'user']

class Slip(models.Model):
	TYPE_CHOICES = (
		('income', 'Income'),
		('expense', 'Expense'),
	)
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='slips')
	tag = models.ForeignKey(Tag, on_delete=models.SET_NULL, null=True, blank=True, related_name='slips')
	account_name = models.CharField(max_length=100)
	amount = models.DecimalField(max_digits=12, decimal_places=2)
	date = models.DateField()
	time = models.TimeField(null=True, blank=True)  # เวลาทำรายการ
	note = models.TextField(blank=True, default='')  # หมายเหตุ
	image = models.ImageField(upload_to='slips/', blank=True, null=True)  # Optional for manual entries
	type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='expense')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f"{self.account_name} - {self.amount} ({self.date})"


