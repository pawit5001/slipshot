from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status, viewsets, permissions, filters, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from django.contrib.auth.models import User
from django.db.models import Sum, Q, Max
from django.http import HttpResponse
from .models import Slip, Tag
from .serializers import SlipSerializer, TagSerializer, UserRegisterSerializer
import easyocr
from PIL import Image
import json
import re
from datetime import datetime

# Check name combination exists
class CheckNameView(APIView):
	permission_classes = [AllowAny]
	
	def post(self, request):
		first_name = request.data.get('first_name', '').strip()
		last_name = request.data.get('last_name', '').strip()
		
		if not first_name or not last_name:
			return Response({'exists': False})
		
		# Check if this exact name combination exists
		exists = User.objects.filter(
			first_name__iexact=first_name,
			last_name__iexact=last_name
		).exists()
		
		if exists:
			return Response({'exists': True}, status=status.HTTP_400_BAD_REQUEST)
		
		return Response({'exists': False})

# User Profile API
class UserProfileView(APIView):
	permission_classes = [IsAuthenticated]
	
	def get(self, request):
		user = request.user
		return Response({
			'id': user.id,
			'username': user.username,
			'email': user.email,
			'first_name': user.first_name,
			'last_name': user.last_name,
			'is_staff': user.is_staff,
		})
	
	def put(self, request):
		user = request.user
		first_name = request.data.get('first_name', user.first_name)
		last_name = request.data.get('last_name', user.last_name)
		email = request.data.get('email', user.email)
		
		user.first_name = first_name
		user.last_name = last_name
		user.email = email
		user.save(update_fields=['first_name', 'last_name', 'email'])
		
		return Response({
			'id': user.id,
			'username': user.username,
			'email': user.email,
			'first_name': user.first_name,
			'last_name': user.last_name,
		}, status=status.HTTP_200_OK)

class UserRegisterView(generics.CreateAPIView):
	queryset = User.objects.all()
	serializer_class = UserRegisterSerializer
	permission_classes = []

class TagViewSet(viewsets.ModelViewSet):
	serializer_class = TagSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		return Tag.objects.filter(user=self.request.user)

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)

class SlipViewSet(viewsets.ModelViewSet):

	@action(detail=False, methods=['post'], url_path='bulk_upload', parser_classes=[MultiPartParser, FormParser])
	def bulk_upload(self, request):
		files = request.FILES.getlist('images')
		if not files:
			return Response({'error': 'No files provided'}, status=400)
		created_slips = []
		errors = []
		user = request.user
		user_fullname = f"{user.first_name} {user.last_name}".strip().lower()
		for file in files:
			data = {
				'account_name': request.data.get('account_name', ''),
				'amount': request.data.get('amount', 0),
				'date': request.data.get('date', None),
				'type': request.data.get('type', 'expense'),
				'tag_id': request.data.get('tag_id', None),
				'image': file,
			}
			serializer = SlipSerializer(data=data)
			if serializer.is_valid():
				slip = serializer.save(user=request.user)
				# Logic: ถ้า account_name ตรงกับชื่อ-นามสกุล user ให้เป็นรายรับ
				if slip.account_name and slip.account_name.strip().lower() == user_fullname:
					slip.type = "income"
					slip.save(update_fields=["type"])
				created_slips.append(SlipSerializer(slip).data)
			else:
				errors.append({'filename': file.name, 'errors': serializer.errors})
		return Response({'created': created_slips, 'errors': errors})

	serializer_class = SlipSerializer
	permission_classes = [permissions.IsAuthenticated]
	parser_classes = [MultiPartParser, FormParser, JSONParser]
	filter_backends = [filters.SearchFilter, filters.OrderingFilter]
	search_fields = ['account_name', 'tag__name', 'type', 'note']
	ordering_fields = ['date', 'amount', 'created_at']

	def get_queryset(self):
		queryset = Slip.objects.filter(user=self.request.user)
		# filter by date range
		start = self.request.query_params.get('start')
		end = self.request.query_params.get('end')
		if start and end:
			queryset = queryset.filter(date__range=[start, end])
		# filter by tag
		tag = self.request.query_params.get('tag')
		if tag:
			queryset = queryset.filter(tag__id=tag)
		# filter by type
		slip_type = self.request.query_params.get('type')
		if slip_type:
			queryset = queryset.filter(type=slip_type)
		return queryset.order_by('-date')

	def perform_create(self, serializer):
		slip = serializer.save(user=self.request.user)
		# Logic: ถ้า account_name ตรงกับชื่อ-นามสกุล user ให้เป็นรายรับ
		user = self.request.user
		user_fullname = f"{user.first_name} {user.last_name}".strip().lower()
		if slip.account_name and slip.account_name.strip().lower() == user_fullname:
			slip.type = "income"
			slip.save(update_fields=["type"])
		return slip

	@action(detail=False, methods=['post'], url_path='ocr', parser_classes=[MultiPartParser, FormParser])
	def ocr(self, request):
		image = request.FILES.get('image')
		if not image:
			return Response({'error': 'No image provided'}, status=400)
		img = Image.open(image)
		# EasyOCR expects a file path or numpy array
		import numpy as np
		img_np = np.array(img)
		reader = easyocr.Reader(['th', 'en'], gpu=False)
		result = reader.readtext(img_np, detail=0, paragraph=True)
		text = '\n'.join(result)
		
		import re
		from datetime import datetime
		from difflib import SequenceMatcher
		
		# --- Post-processing: แก้ OCR errors ที่พบบ่อย ---
		def fix_ocr_common(text):
			# แก้ o หรือ O ที่อยู่ระหว่างตัวเลขให้เป็น 0
			text = re.sub(r'(?<=\d)[oO](?=\d)', '0', text)
			# แก้ o/O ที่อยู่ในเลขบัญชี/จำนวนเงิน
			text = re.sub(r'([xX\d])[oO]([xX\d])', r'\g<1>0\g<2>', text)
			# แก้ l/I เป็น 1 เมื่ออยู่ระหว่างตัวเลข
			text = re.sub(r'(?<=\d)[lI](?=\d)', '1', text)
			# แก้ S/s เป็น 5 เมื่ออยู่ระหว่างตัวเลข
			text = re.sub(r'(?<=\d)[Ss](?=\d)', '5', text)
			# แก้ B เป็น 8 เมื่ออยู่ระหว่างตัวเลข
			text = re.sub(r'(?<=\d)B(?=\d)', '8', text)
			return text
		text = fix_ocr_common(text)

		# --- Enhanced Pattern สำหรับ slip ธนาคารต่างๆ ---
		# ชื่อ patterns: รองรับหลายธนาคาร (เรียงตามความแม่นยำ)
		name_patterns = [
			# === PromptPay patterns ===
			r'(?:พร้อมเพย์|PromptPay|พร้อม\s*เพย์)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			
			# === Pattern สำหรับชื่อผู้รับ ===
			r'(?:ผู้รับ|To|ไปยัง|ชื่อผู้รับ|Recipient|บัญชีปลายทาง)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			r'(?:Account\s*Name|ชื่อบัญชี)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			
			# === Pattern สำหรับชื่อผู้โอน ===
			r'(?:ผู้โอน|From|จาก|ชื่อผู้โอน|Sender)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			r'(?:รับเงินจาก|โอนจาก|Transfer\s*from)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			
			# === Pattern สำหรับธนาคารไทย ===
			# กสิกร (K-PLUS)
			r'(?:โอนให้|โอนไปยัง|ไปบัญชี)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			# SCB Easy
			r'(?:ผู้รับเงิน|ปลายทาง)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			# กรุงเทพ, กรุงไทย
			r'(?:บัญชีผู้รับ|Account)[\s\n:]*([ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			
			# === Pattern คำนำหน้าชื่อ ===
			r'((?:นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)\s*[ก-๙a-zA-Z]+\s+[ก-๙a-zA-Z]+\.?)',
			
			# === Pattern ชื่อภาษาไทย 2-3 คำ ===
			r'^\s*([ก-๙]+\s+[ก-๙]+\.?)\s*$',
			# ชื่อภาษาไทยที่ต่อจากข้อความ
			r'[:\s]([ก-๙]+\s+[ก-๙]+\.?)\s*(?:\n|$)',
		]
		
		found_names = []
		for pattern in name_patterns:
			matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
			for m in matches:
				name = m.strip()
				# ตัด prefix ออก
				name = re.sub(r'^(นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)\s*', '', name, flags=re.IGNORECASE)
				# ตัดช่องว่างซ้ำ
				name = ' '.join(name.split())
				# ตรวจสอบความถูกต้อง
				if name and len(name) > 2:
					# ไม่เอาถ้าเป็นตัวเลขหรือคำไม่ใช่ชื่อ
					if not re.match(r'^[\d\s.,]+$', name):
						# ไม่เอาถ้าเป็นคำทั่วไปที่ไม่ใช่ชื่อ
						exclude_words = ['โอนเงิน', 'สำเร็จ', 'บาท', 'รายการ', 'ธนาคาร', 'บัญชี', 'เลขที่', 'หมายเหตุ', 'วันที่', 'เวลา']
						if not any(word in name for word in exclude_words):
							if name not in found_names:
								found_names.append(name)

		# --- Enhanced ดึงจำนวนเงิน ---
		amount_patterns = [
			# Pattern หลัก: จำนวนเงินที่มี label
			r'(?:จำนวน|Amount|ยอดเงิน|ยอดโอน|ยอดรวม|THB|฿|Total)\s*[:\s]*([\d,]+\.?\d*)',
			# Pattern: จำนวนเงิน + "บาท"
			r'([\d,]+\.?\d*)\s*(?:บาท|THB|฿)',
			# Pattern: ตัวเลขขนาดใหญ่ที่น่าจะเป็นจำนวนเงิน (1,000+)
			r'(?:^|\s)([\d,]{4,}\.?\d{0,2})(?:\s|$|\n)',
			# Pattern: ตัวเลขทศนิยม 2 ตำแหน่ง (ราคา)
			r'(?:^|\s)([\d,]+\.\d{2})(?:\s|$|\n)',
		]
		found_amounts = []
		for pattern in amount_patterns:
			matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
			for match in matches:
				amt_str = match.replace(',', '')
				try:
					amount = float(amt_str)
					if 0 < amount < 1000000000:  # ตัดค่าที่ไม่สมเหตุผล
						found_amounts.append(amount)
				except:
					pass
		
		# เลือกจำนวนเงินที่น่าจะถูกต้องที่สุด (มักเป็นค่าสูงสุดที่สมเหตุผล)
		found_amount = None
		if found_amounts:
			# ถ้ามีหลายค่า ใช้ค่าที่ใหญ่ที่สุดแต่ไม่เกิน 10 ล้าน
			reasonable_amounts = [a for a in found_amounts if a <= 10000000]
			if reasonable_amounts:
				found_amount = max(reasonable_amounts)
			else:
				found_amount = min(found_amounts)

		# --- Enhanced ดึงวันที่ ---
		date_patterns = [
			# DD/MM/YYYY หรือ DD-MM-YYYY
			r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})',
			# DD MMM YYYY (Thai: 15 ก.พ. 2567)
			r'(\d{1,2})\s*(ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4}|\d{2})',
			# DD MMM YYYY (English)
			r'(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(\d{4}|\d{2})',
			# ISO format: YYYY-MM-DD
			r'(\d{4})-(\d{2})-(\d{2})',
			# Thai date format: วันที่ DD เดือน ปี
			r'วันที่\s*(\d{1,2})\s*(ม\.?ค\.?|ก\.?พ\.?|มี\.?ค\.?|เม\.?ย\.?|พ\.?ค\.?|มิ\.?ย\.?|ก\.?ค\.?|ส\.?ค\.?|ก\.?ย\.?|ต\.?ค\.?|พ\.?ย\.?|ธ\.?ค\.?|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม)\s*(\d{4}|\d{2})',
		]
		thai_months = {
			'ม.ค.': 1, 'มค': 1, 'ม.ค': 1, 'มกราคม': 1,
			'ก.พ.': 2, 'กพ': 2, 'ก.พ': 2, 'กุมภาพันธ์': 2,
			'มี.ค.': 3, 'มีค': 3, 'มี.ค': 3, 'มีนาคม': 3,
			'เม.ย.': 4, 'เมย': 4, 'เม.ย': 4, 'เมษายน': 4,
			'พ.ค.': 5, 'พค': 5, 'พ.ค': 5, 'พฤษภาคม': 5,
			'มิ.ย.': 6, 'มิย': 6, 'มิ.ย': 6, 'มิถุนายน': 6,
			'ก.ค.': 7, 'กค': 7, 'ก.ค': 7, 'กรกฎาคม': 7,
			'ส.ค.': 8, 'สค': 8, 'ส.ค': 8, 'สิงหาคม': 8,
			'ก.ย.': 9, 'กย': 9, 'ก.ย': 9, 'กันยายน': 9,
			'ต.ค.': 10, 'ตค': 10, 'ต.ค': 10, 'ตุลาคม': 10,
			'พ.ย.': 11, 'พย': 11, 'พ.ย': 11, 'พฤศจิกายน': 11,
			'ธ.ค.': 12, 'ธค': 12, 'ธ.ค': 12, 'ธันวาคม': 12,
		}
		eng_months = {
			'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
			'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
		}
		found_date = None
		for pattern in date_patterns:
			match = re.search(pattern, text, re.IGNORECASE)
			if match:
				groups = match.groups()
				try:
					if len(groups) == 3:
						if groups[0].isdigit() and len(groups[0]) == 4:
							# ISO format: YYYY-MM-DD
							found_date = f"{groups[0]}-{groups[1]}-{groups[2]}"
						else:
							day = int(groups[0])
							month_str = groups[1].lower().replace('.', '')
							year = int(groups[2])
							
							# Determine month number
							month = thai_months.get(groups[1], thai_months.get(month_str))
							if not month:
								month = eng_months.get(month_str[:3], None)
							if not month and groups[1].isdigit():
								month = int(groups[1])
							
							if month:
								# Handle Buddhist Era (พ.ศ.)
								if year > 2500:
									year -= 543
								elif year < 100:
									# ปี 2 หลักจาก slip ไทย เช่น 69 = พ.ศ. 2569 = ค.ศ. 2026
									# ถ้าปี 2 หลัก >= 50 ถือว่าเป็น 25xx (พ.ศ.)
									# ถ้าปี 2 หลัก < 50 ถือว่าเป็น 20xx (ค.ศ.)
									if year >= 50:
										year = 2500 + year - 543  # 69 → 2569 - 543 = 2026
									else:
										year = 2000 + year  # 25 → 2025
								
								# Validate date
								if 1 <= day <= 31 and 1 <= month <= 12 and 1900 <= year <= 2100:
									found_date = f"{year}-{month:02d}-{day:02d}"
									break
				except:
					pass

		# --- Enhanced กำหนด transaction type ---
		type_keywords = {
			'income': ['รับเงิน', 'รับโอน', 'เงินเข้า', 'Received', 'ได้รับ', 'Income', 'เข้าบัญชี', 'Deposit', 'รับจาก', 'โอนมา', 'รับ'],
			'expense': ['โอนเงิน', 'จ่ายเงิน', 'ชำระ', 'Payment', 'Transfer', 'Paid', 'ถอน', 'โอนไป', 'ออกจากบัญชี', 'Withdrawal', 'โอนให้', 'จ่าย', 'ชำระเงิน'],
		}
		detected_type = None
		type_confidence = 'unknown'
		text_lower = text.lower()
		for t_type, keywords in type_keywords.items():
			for kw in keywords:
				if kw.lower() in text_lower:
					detected_type = t_type
					type_confidence = 'keyword'
					break
			if detected_type:
				break

		# --- Enhanced เปรียบเทียบชื่อกับ user ---
		user = request.user if request.user.is_authenticated else None
		user_fullname = None
		user_firstname = None
		user_lastname = None
		match_status = None
		match_detail = None
		match_confidence = None
		suggested_type = detected_type or 'expense'
		suggested_account_name = found_names[0] if found_names else ''
		
		def normalize(s):
			"""Normalize string for comparison"""
			if not s:
				return ''
			# Remove periods, extra spaces, common prefixes
			s = s.replace('.', '').strip()
			s = re.sub(r'^(นาย|นาง|นางสาว|น\.?ส\.?|Mr|Mrs|Ms)\.?\s*', '', s, flags=re.IGNORECASE)
			return ' '.join(s.lower().split())
		
		def strip_abbreviation(s):
			"""Clean abbreviation markers like . or spaces at end"""
			if not s:
				return ''
			return s.rstrip('.').strip()
		
		def similarity_ratio(s1, s2):
			"""Calculate similarity ratio between two strings"""
			return SequenceMatcher(None, s1, s2).ratio()
		
		def match_name_advanced(slip_name, user_first, user_last):
			"""
			Advanced name matching with fuzzy matching support:
			- Full match: ชื่อ นามสกุล ตรงทั้งหมด
			- Partial match: ชื่อตรง + นามสกุลใกล้เคียง
			- Fuzzy match: คล้ายกัน >= 80%
			Returns: (is_match, confidence, detail)
			"""
			slip_norm = normalize(slip_name)
			user_first_norm = normalize(user_first)
			user_last_norm = normalize(user_last)
			user_full_norm = f"{user_first_norm} {user_last_norm}"
			
			if not slip_norm:
				return (False, 'none', 'ไม่พบชื่อใน slip')
			
			slip_parts = slip_norm.split()
			if not slip_parts:
				return (False, 'none', 'ไม่พบชื่อใน slip')
			
			slip_first = slip_parts[0]
			slip_last = slip_parts[1] if len(slip_parts) > 1 else ''
			
			# Case 1: Full exact match
			if slip_norm == user_full_norm:
				return (True, 'full', f'ชื่อ-นามสกุลตรงกันทั้งหมด: {slip_name}')
			
			# Case 2: High similarity match (>= 85%)
			full_similarity = similarity_ratio(slip_norm, user_full_norm)
			if full_similarity >= 0.85:
				return (True, 'fuzzy_full', f'ชื่อ-นามสกุลใกล้เคียงมาก ({int(full_similarity*100)}%): {slip_name}')
			
			# Case 3: First name exact match
			if slip_first == user_first_norm:
				if not slip_last:
					return (True, 'first_only', f'ชื่อตรง (ไม่มีนามสกุลใน slip): {slip_name}')
				# Handle short abbreviation (1-2 chars) like "ว" or "วี" for "วีรคุปต์"
				elif len(slip_last) <= 2 and user_last_norm.startswith(slip_last):
					return (True, 'abbreviated', f'ชื่อตรง นามสกุลย่อ: {slip_name}')
				elif user_last_norm.startswith(slip_last):
					return (True, 'abbreviated', f'ชื่อตรง นามสกุลย่อ: {slip_name}')
				elif slip_last.startswith(user_last_norm[:3]) if len(user_last_norm) >= 3 else False:
					return (True, 'partial', f'ชื่อตรง นามสกุลใกล้เคียง: {slip_name}')
				else:
					# Last name similarity check
					last_similarity = similarity_ratio(slip_last, user_last_norm)
					if last_similarity >= 0.7:
						return (True, 'partial', f'ชื่อตรง นามสกุลใกล้เคียง ({int(last_similarity*100)}%): {slip_name}')
					# Allow if slip_last is very short (could be abbreviation)
					if len(slip_last) <= 2:
						return (True, 'abbreviated', f'ชื่อตรง นามสกุลอาจย่อ: {slip_name}')
					return (False, 'first_only_different_last', f'ชื่อตรงแต่นามสกุลต่างกัน: {slip_name} vs {user_last}')
			
			# Case 4: First name similarity check
			first_similarity = similarity_ratio(slip_first, user_first_norm)
			if first_similarity >= 0.8:
				if not slip_last:
					return (True, 'fuzzy_first', f'ชื่อใกล้เคียง ({int(first_similarity*100)}%): {slip_name}')
				last_similarity = similarity_ratio(slip_last, user_last_norm) if slip_last else 0
				if last_similarity >= 0.6:
					return (True, 'fuzzy_both', f'ชื่อ-นามสกุลใกล้เคียง: {slip_name}')
			
			# Case 5: Check if first name starts with slip name
			if user_first_norm.startswith(slip_first) and len(slip_first) >= 2:
				return (True, 'name_abbreviated', f'ชื่อย่อตรง: {slip_name}')
			
			return (False, 'no_match', f'ไม่ตรงกัน: {slip_name}')
		
		if user:
			user_firstname = user.first_name
			user_lastname = user.last_name
			user_fullname = f"{user_firstname} {user_lastname}".strip()
			
			# หาชื่อที่ตรงกับ user
			best_match = None
			best_confidence = 'none'
			confidence_priority = ['full', 'fuzzy_full', 'abbreviated', 'partial', 'first_only', 'fuzzy_first', 'fuzzy_both', 'name_abbreviated']
			
			for found in found_names:
				is_match, confidence, detail = match_name_advanced(found, user_firstname, user_lastname)
				if is_match:
					# Check if this match is better than previous
					if best_match is None or (confidence in confidence_priority and 
						confidence_priority.index(confidence) < confidence_priority.index(best_confidence)):
						best_match = found
						best_confidence = confidence
						match_detail = detail
			
			if best_match:
				match_status = True
				match_confidence = best_confidence
				# ถ้าชื่อตรงกับ user = น่าจะเป็นรายรับ (เงินเข้า)
				if detected_type is None:
					suggested_type = 'income'
					type_confidence = 'name_match'
				# Use user's full name as account name (cleaner)
				suggested_account_name = user_fullname
			else:
				match_status = False
				match_confidence = 'no_match'
				if not match_detail:
					match_detail = f"ไม่พบชื่อตรงกับผู้ใช้ ({user_fullname})"
				# ถ้าไม่ตรง = น่าจะเป็นรายจ่าย
				if detected_type is None:
					suggested_type = 'expense'
					type_confidence = 'name_no_match'
		
		# สร้าง warning ถ้าไม่สามารถระบุประเภทได้แน่นอน
		type_warning = None
		is_valid_slip = True
		
		# ตรวจสอบว่าเป็น slip หรือไม่
		if not found_amount and not found_names:
			type_warning = 'ไม่พบข้อมูลสลิป อาจไม่ใช่รูปสลิปโอนเงิน'
			is_valid_slip = False
			suggested_type = None  # ไม่ระบุประเภทเมื่อไม่ใช่ slip
		elif not found_amount:
			type_warning = 'ไม่พบจำนวนเงินในรูป กรุณากรอกข้อมูลเอง'
			is_valid_slip = False
			suggested_type = None  # ไม่ระบุประเภทเมื่อไม่พบจำนวนเงิน
		elif not found_names:
			type_warning = 'ไม่พบชื่อบัญชีในรูป กรุณากรอกข้อมูลเอง'
		elif type_confidence in ['unknown', 'name_match', 'name_no_match']:
			type_warning = 'ไม่สามารถระบุประเภทได้แน่นอน กรุณาตรวจสอบอีกครั้ง'

		return Response({
			'text': text,
			'found_names': found_names,
			'user_fullname': user_fullname,
			'match': match_status,
			'match_detail': match_detail,
			'match_confidence': match_confidence,
			'is_valid_slip': is_valid_slip,
			# ข้อมูลที่ดึงได้
			'extracted': {
				'account_name': suggested_account_name,
				'transaction_title': self.extract_transaction_title(text),  # หัวข้อรายการ
				'amount': found_amount,
				'date': found_date or datetime.now().strftime('%Y-%m-%d'),
				'time': self.extract_time(text),  # ส่งเวลาจาก OCR กลับไป ให้ frontend ตัดสินใจใช้หรือไม่
				'type': suggested_type,  # จะเป็น None ถ้าไม่ใช่ slip
				'type_confidence': type_confidence,
				'type_warning': type_warning,
			}
		})
	
	def extract_transaction_title(self, text):
		"""ดึงหัวข้อรายการจาก slip เช่น เติมเงินสำเร็จ, โอนเงินสำเร็จ"""
		title_patterns = [
			# Thai bank transaction titles
			r'(เติมเงินสำเร็จ)',
			r'(โอนเงินสำเร็จ)',
			r'(รายการสำเร็จ)',
			r'(ชำระเงินสำเร็จ)',
			r'(รับเงินสำเร็จ)',
			r'(ถอนเงินสำเร็จ)',
			r'(จ่ายบิลสำเร็จ)',
			r'(เติมเงินพร้อมเพย์)',
			# English titles
			r'(Scan\s*to\s*pay\s*สำเร็จ)',
			r'(Transfer\s*successful)',
			r'(Payment\s*successful)',
			r'(Transaction\s*successful)',
			# Pattern for any title ending with สำเร็จ
			r'([ก-๙a-zA-Z\s]+สำเร็จ)',
			# Pattern for titles with "โอนเงินให้"
			r'(โอนเงินให้\s*[ก-๙a-zA-Z\s]+)',
		]
		
		for pattern in title_patterns:
			match = re.search(pattern, text, re.IGNORECASE)
			if match:
				title = match.group(1).strip()
				# ตัดให้สั้นลงถ้ายาวเกิน
				if len(title) > 30:
					title = title[:30] + '...'
				return title
		return None
	
	def extract_time(self, text):
		"""ดึงเวลาทำรายการจาก slip"""
		time_patterns = [
			# HH:MM:SS format
			r'(\d{1,2}:\d{2}:\d{2})',
			# HH:MM format
			r'(\d{1,2}:\d{2})\s*(?:น\.|น|AM|PM|$)',
			# Thai format: เวลา HH:MM
			r'เวลา\s*(\d{1,2}:\d{2})',
			# Time after comma or space with date
			r',\s*(\d{1,2}:\d{2})',
			# Time pattern like "19:09"
			r'(?:\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})[,\s]+(\d{1,2}:\d{2})',
		]
		
		for pattern in time_patterns:
			match = re.search(pattern, text)
			if match:
				time_str = match.group(1)
				# Parse and validate time
				try:
					parts = time_str.split(':')
					hour = int(parts[0])
					minute = int(parts[1])
					if 0 <= hour <= 23 and 0 <= minute <= 59:
						return f"{hour:02d}:{minute:02d}"
				except:
					pass
		return None




class DashboardView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		# รับ period_type (day/week/month/year) และ period_value จาก query param
		period_type = request.query_params.get('period_type', 'month')
		period_value = request.query_params.get('period_value')
		user = request.user
		slips = Slip.objects.filter(user=user)
		
		from datetime import datetime, timedelta
		from django.utils import timezone
		from django.db.models import Count
		from django.db.models.functions import TruncDate
		
		start_date = None
		end_date = None
		
		if period_type == 'day' and period_value:
			# period_value: YYYY-MM-DD
			slips = slips.filter(date=period_value)
			start_date = datetime.strptime(period_value, '%Y-%m-%d').date()
			end_date = start_date
		elif period_type == 'week' and period_value:
			# period_value: YYYY-MM-DD (วันเริ่มต้นของสัปดาห์)
			start_date = datetime.strptime(period_value, '%Y-%m-%d').date()
			end_date = start_date + timedelta(days=6)
			slips = slips.filter(date__range=[start_date, end_date])
		elif period_type == 'month' and period_value:
			year, month = map(int, period_value.split('-'))
			slips = slips.filter(date__year=year, date__month=month)
			start_date = datetime(year, month, 1).date()
			if month == 12:
				end_date = datetime(year + 1, 1, 1).date() - timedelta(days=1)
			else:
				end_date = datetime(year, month + 1, 1).date() - timedelta(days=1)
		elif period_type == 'year' and period_value:
			year = int(period_value)
			slips = slips.filter(date__year=year)
			start_date = datetime(year, 1, 1).date()
			end_date = datetime(year, 12, 31).date()
			
		income = slips.filter(type='income').aggregate(Sum('amount'))['amount__sum'] or 0
		expense = slips.filter(type='expense').aggregate(Sum('amount'))['amount__sum'] or 0
		balance = income - expense
		
		# รายการล่าสุด 5 รายการ
		recent_slips = slips.order_by('-date', '-created_at')[:5]
		recent_list = [{
			'id': s.id,
			'account_name': s.account_name,
			'amount': float(s.amount),
			'date': str(s.date),
			'type': s.type,
			'tag_name': s.tag.name if s.tag else None,
		} for s in recent_slips]
		
		# Tag breakdown - สัดส่วนรายจ่ายตาม tag
		tag_breakdown = []
		expense_slips = slips.filter(type='expense')
		tag_stats = expense_slips.values('tag__id', 'tag__name').annotate(
			total=Sum('amount'),
			count=Count('id')
		).order_by('-total')
		for stat in tag_stats:
			if stat['tag__id']:
				tag_breakdown.append({
					'tag_id': stat['tag__id'],
					'tag_name': stat['tag__name'],
					'amount': float(stat['total']),
					'count': stat['count'],
				})
			else:
				tag_breakdown.append({
					'tag_id': None,
					'tag_name': 'ไม่มีหมวดหมู่',
					'amount': float(stat['total']),
					'count': stat['count'],
				})
		
		# Daily trend data for charts
		daily_trend = []
		# Always show trend data - use 7 days for day view, actual range for others
		trend_start = start_date
		trend_end = end_date
		
		# For daily view, show last 7 days trend
		if period_type == 'day':
			trend_end = start_date if start_date else timezone.now().date()
			trend_start = trend_end - timedelta(days=6)
		
		if trend_start and trend_end:
			# Get all dates in range
			from datetime import date as date_type
			current = trend_start
			date_map = {}
			while current <= trend_end:
				date_map[str(current)] = {'date': str(current), 'income': 0, 'expense': 0, 'count': 0}
				current += timedelta(days=1)
			
			# Fill in actual data - use all user slips in the trend range
			trend_slips = Slip.objects.filter(user=user, date__range=[trend_start, trend_end])
			daily_data = trend_slips.annotate(
				day=TruncDate('date')
			).values('day').annotate(
				income_total=Sum('amount', filter=Q(type='income')),
				expense_total=Sum('amount', filter=Q(type='expense')),
				count=Count('id')
			).order_by('day')
			
			for item in daily_data:
				date_str = str(item['day'])
				if date_str in date_map:
					date_map[date_str] = {
						'date': date_str,
						'income': float(item['income_total'] or 0),
						'expense': float(item['expense_total'] or 0),
						'count': item['count'],
					}
			
			# Convert to sorted list
			daily_trend = sorted(date_map.values(), key=lambda x: x['date'])
		
		return Response({
			'income': float(income),
			'expense': float(expense),
			'balance': float(balance),
			'recent_slips': recent_list,
			'slip_count': slips.count(),
			'tag_breakdown': tag_breakdown,
			'daily_trend': daily_trend,
		})


class LeaderboardView(APIView):
	"""Public leaderboard with masked usernames"""
	permission_classes = [IsAuthenticated]
	
	def mask_name(self, name):
		"""Mask name: show first 2 chars + *** + last char"""
		if not name or len(name) <= 3:
			return name[:1] + '***' if name else '***'
		return name[:2] + '***' + name[-1]
	
	def get(self, request):
		from django.db.models import Count
		from django.utils import timezone
		from datetime import timedelta
		
		current_user_id = request.user.id
		today = timezone.now().date()
		month_ago = today - timedelta(days=30)
		
		# Top users by slip count (all time) - only top 3
		top_users = User.objects.annotate(
			slip_count=Count('slips'),
			total_amount=Sum('slips__amount')
		).filter(slip_count__gt=0).order_by('-slip_count', '-total_amount', 'id')[:3]
		
		top_users_data = []
		current_user_in_top3 = False
		for i, u in enumerate(top_users):
			display_name = f"{u.first_name} {u.last_name}".strip() or u.username
			is_me = u.id == current_user_id
			if is_me:
				current_user_in_top3 = True
			top_users_data.append({
				'rank': i + 1,
				'display_name': self.mask_name(display_name),
				'slip_count': u.slip_count,
				'total_amount': float(u.total_amount or 0),
				'is_me': is_me,
			})
		
		# Recent active users (last 30 days by slip creation)
		recent_active = User.objects.filter(
			slips__created_at__date__gte=month_ago
		).annotate(
			recent_slip_count=Count('slips', filter=Q(slips__created_at__date__gte=month_ago)),
			recent_amount=Sum('slips__amount', filter=Q(slips__created_at__date__gte=month_ago)),
			latest_slip=Max('slips__created_at')
		).filter(recent_slip_count__gt=0).order_by('-latest_slip').distinct()[:5]
		
		recent_users_data = []
		for u in recent_active:
			display_name = f"{u.first_name} {u.last_name}".strip() or u.username
			recent_users_data.append({
				'display_name': self.mask_name(display_name),
				'slip_count': u.recent_slip_count,
				'total_amount': float(u.recent_amount or 0),
				'is_me': u.id == current_user_id,
			})
		
		# Current user's rank (considering tie-breakers: slip_count desc, total_amount desc, id asc)
		my_slip_count = Slip.objects.filter(user=request.user).count()
		my_total_amount = Slip.objects.filter(user=request.user).aggregate(Sum('amount'))['amount__sum'] or 0
		
		# Count users who are ranked higher (more slips, or same slips but more amount, or same both but lower id)
		my_rank = User.objects.annotate(
			slip_count=Count('slips'),
			total_amount=Sum('slips__amount')
		).filter(
			Q(slip_count__gt=my_slip_count) |
			Q(slip_count=my_slip_count, total_amount__gt=my_total_amount) |
			Q(slip_count=my_slip_count, total_amount=my_total_amount, id__lt=request.user.id)
		).count() + 1
		
		# Current user's data for display (if not in top 3)
		my_user_data = None
		if not current_user_in_top3 and my_slip_count > 0:
			display_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
			my_user_data = {
				'rank': my_rank,
				'display_name': self.mask_name(display_name),
				'slip_count': my_slip_count,
				'total_amount': float(my_total_amount),
				'is_me': True,
			}
		
		return Response({
			'top_users': top_users_data,
			'recent_active': recent_users_data,
			'my_rank': my_rank,
			'my_slip_count': my_slip_count,
			'my_user_data': my_user_data,  # None if in top 3 or no slips
		})


def home(request):
	return HttpResponse("Hello, Slipshot!")