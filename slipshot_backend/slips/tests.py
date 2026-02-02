from django.test import TestCase
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from .models import Slip, Tag
from django.urls import reverse
from rest_framework import status
import tempfile
from PIL import Image

class SlipAPITestCase(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(username='testuser', password='testpass', first_name='Test', last_name='User')
		self.tag = Tag.objects.create(name='Food', user=self.user)

	def get_token(self):
		url = reverse('token_obtain_pair')
		resp = self.client.post(url, {'username': 'testuser', 'password': 'testpass'})
		return resp.data['access']

	def test_register(self):
		url = reverse('register')
		data = {'username': 'newuser', 'password': 'newpass', 'first_name': 'New', 'last_name': 'User'}
		resp = self.client.post(url, data)
		self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

	def test_login(self):
		url = reverse('token_obtain_pair')
		resp = self.client.post(url, {'username': 'testuser', 'password': 'testpass'})
		self.assertEqual(resp.status_code, status.HTTP_200_OK)
		self.assertIn('access', resp.data)

	def test_create_slip(self):
		token = self.get_token()
		self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
		url = reverse('slip-list')
		# สร้างไฟล์รูปชั่วคราว
		image = Image.new('RGB', (100, 100))
		tmp = tempfile.NamedTemporaryFile(suffix='.jpg')
		image.save(tmp, format='JPEG')
		tmp.seek(0)
		data = {
			'account_name': 'Test Account',
			'amount': 100,
			'date': '2026-02-02',
			'type': 'expense',
			'tag_id': self.tag.id,
			'image': tmp,
		}
		resp = self.client.post(url, data, format='multipart')
		self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

	def test_bulk_upload(self):
		token = self.get_token()
		self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
		url = reverse('slip-bulk-upload')
		# สร้างไฟล์รูป 2 ไฟล์
		images = []
		for _ in range(2):
			image = Image.new('RGB', (100, 100))
			tmp = tempfile.NamedTemporaryFile(suffix='.jpg')
			image.save(tmp, format='JPEG')
			tmp.seek(0)
			images.append(tmp)
		data = {
			'account_name': 'Bulk Account',
			'amount': 200,
			'date': '2026-02-02',
			'type': 'expense',
			'tag_id': self.tag.id,
			'images': [img for img in images],
		}
		resp = self.client.post(url, data, format='multipart')
		self.assertEqual(resp.status_code, status.HTTP_200_OK)
		self.assertEqual(len(resp.data['created']), 2)
