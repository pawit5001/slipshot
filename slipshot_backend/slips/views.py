from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status, viewsets, permissions, filters, generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.decorators import action
from django.contrib.auth.models import User
from django.db.models import Sum, Q, Max
from django.http import HttpResponse
from django.conf import settings
from .models import Slip, Tag
from .serializers import SlipSerializer, TagSerializer, UserRegisterSerializer
from PIL import Image
import requests as http_requests
import base64
import io
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

	def create(self, request, *args, **kwargs):
		# Debug: Print incoming data
		print("=== SLIP CREATE DEBUG ===")
		print("Request data:", request.data)
		print("Request FILES:", request.FILES)
		
		serializer = self.get_serializer(data=request.data)
		if not serializer.is_valid():
			print("Validation errors:", serializer.errors)
			return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
		
		slip = serializer.save(user=request.user)
		
		# Logic: ถ้า account_name ตรงกับชื่อ-นามสกุล user ให้เป็นรายรับ
		user = request.user
		user_fullname = f"{user.first_name} {user.last_name}".strip().lower()
		if slip.account_name and slip.account_name.strip().lower() == user_fullname:
			slip.type = "income"
			slip.save(update_fields=["type"])
		
		headers = self.get_success_headers(serializer.data)
		return Response(SlipSerializer(slip).data, status=status.HTTP_201_CREATED, headers=headers)

	@action(detail=False, methods=['post'], url_path='ocr', parser_classes=[MultiPartParser, FormParser])
	def ocr(self, request):
		image = request.FILES.get('image')
		if not image:
			return Response({'error': 'No image provided'}, status=400)
		
		# Use OCR.space API (Free: 25,000 requests/month)
		text = ""
		ocr_available = True
		
		try:
			# Read image and convert to base64
			image_data = image.read()
			base64_image = base64.b64encode(image_data).decode('utf-8')
			
			# Get API key from settings or use free tier key
			api_key = getattr(settings, 'OCR_SPACE_API_KEY', 'K85695728488957')  # Free API key
			
			# Call OCR.space API
			payload = {
				'base64Image': f'data:image/jpeg;base64,{base64_image}',
				'language': 'tha',  # Thai language
				'isOverlayRequired': False,
				'detectOrientation': True,
				'scale': True,
				'OCREngine': 2,  # Engine 2 is better for Thai
			}
			
			response = http_requests.post(
				'https://api.ocr.space/parse/image',
				data=payload,
				headers={'apikey': api_key},
				timeout=30
			)
			
			if response.status_code == 200:
				result = response.json()
				if result.get('ParsedResults') and len(result['ParsedResults']) > 0:
					text = result['ParsedResults'][0].get('ParsedText', '')
					print(f"OCR.space result: {text[:200]}...")  # Debug log
				else:
					error_msg = result.get('ErrorMessage', 'Unknown error')
					print(f"OCR.space error: {error_msg}")
					ocr_available = False
			else:
				print(f"OCR.space HTTP error: {response.status_code}")
				ocr_available = False
				
		except Exception as e:
			print(f"OCR error: {str(e)}")
			ocr_available = False
			text = ""
		
		import re
		from datetime import datetime
		from difflib import SequenceMatcher
		
		# === ตรวจสอบว่าเป็น slip ธนาคารจริงหรือไม่ ===
		slip_keywords = [
			# Keywords ที่บ่งบอกว่าเป็น slip
			'โอนเงิน', 'เติมเงิน', 'ชำระ', 'รับเงิน', 'ถอนเงิน',
			'สำเร็จ', 'successful', 'transfer', 'payment',
			'พร้อมเพย์', 'promptpay', 'prompt pay',
			'ธนาคาร', 'bank', 'scb', 'kbank', 'ktb', 'bbl', 'tmb', 'ttb', 'gsb', 'bay',
			'กสิกร', 'ไทยพาณิชย์', 'กรุงเทพ', 'กรุงไทย', 'กรุงศรี', 'ออมสิน', 'ทหารไทย',
			'บาท', 'thb', '฿',
			'เลขที่รายการ', 'รหัสอ้างอิง', 'reference', 'ref',
			'ผู้โอน', 'ผู้รับ', 'จาก', 'ไปยัง', 'to', 'from',
			'บัญชี', 'account', 'xxx-', 'x-x',
			'ค่าธรรมเนียม', 'fee',
			'wallet', 'e-wallet', 'true money', 'truemoney',
		]
		
		text_lower = text.lower()
		slip_keyword_count = sum(1 for kw in slip_keywords if kw.lower() in text_lower)
		
		# ต้องมีอย่างน้อย 3 keywords ที่บ่งบอกว่าเป็น slip
		is_likely_slip = slip_keyword_count >= 3
		
		# ถ้าไม่ใช่ slip ให้ return error ทันที
		if not is_likely_slip:
			return Response({
				'error': 'ไม่พบข้อมูลสลิปโอนเงินในรูปภาพ',
				'is_valid_slip': False,
				'text': text,
				'slip_keyword_count': slip_keyword_count,
				'extracted': None,
			}, status=400)
		
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

		# === ดึงชื่อผู้รับ (Receiver) แยกจากชื่อผู้โอน (Sender) ===
		# === Pattern สำหรับ "โอนเงินให้ [ชื่อ]" - ชื่อคือผู้รับ ===
		transfer_to_pattern = r'โอนเงินให้\s*(?:นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)?\s*([ก-๙a-zA-Z]+\s*[ก-๙a-zA-Z]*\.?)'
		
		receiver_patterns = [
			transfer_to_pattern,  # "โอนเงินให้ นาย ปวิช" → ปวิช เป็นผู้รับ
			r'(?:ผู้รับ|To|ไปยัง|ชื่อผู้รับ|Recipient|บัญชีปลายทาง|ผู้รับเงิน|ปลายทาง|บัญชีผู้รับ|โอนให้|โอนไปยัง|ไปบัญชี)[\s\n:]+(?:นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)?\s*([ก-๙a-zA-Z]+\s*[ก-๙a-zA-Z]*\.?)',
			r'(?:พร้อมเพย์|PromptPay)[\s\n:]+(?:นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)?\s*([ก-๙a-zA-Z]+\s*[ก-๙a-zA-Z]*\.?)',
		]
		sender_patterns = [
			r'(?:ผู้โอน|From|จาก|ชื่อผู้โอน|Sender|รับเงินจาก|โอนจาก|Transfer\s*from|ได้รับจาก|เงินจาก)[\s\n:]+(?:นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)?\s*([ก-๙a-zA-Z]+\s*[ก-๙a-zA-Z]*\.?)',
		]
		
		def clean_name(n):
			if not n: return ''
			n = n.strip()
			n = re.sub(r'^(นาย|นาง|นางสาว|น\.ส\.|Mr\.|Mrs\.|Ms\.)\s*', '', n, flags=re.IGNORECASE)
			return ' '.join(n.split())
		
		def is_valid_name(n):
			if not n or len(n) < 2: return False
			if re.match(r'^[\d\s.,]+$', n): return False
			exclude = ['โอนเงิน', 'สำเร็จ', 'บาท', 'รายการ', 'ธนาคาร', 'บัญชี', 'เลขที่', 'หมายเหตุ', 'วันที่', 'เวลา', 'จำนวน']
			return not any(w in n for w in exclude)
		
		# ดึงชื่อผู้รับ
		found_receivers = []
		for pattern in receiver_patterns:
			for m in re.findall(pattern, text, re.IGNORECASE | re.MULTILINE):
				name = clean_name(m)
				if is_valid_name(name) and name not in found_receivers:
					found_receivers.append(name)
		
		# ดึงชื่อผู้โอน/ผู้ส่ง (รวม pattern "จาก")
		found_senders = []
		for pattern in sender_patterns:
			for m in re.findall(pattern, text, re.IGNORECASE | re.MULTILINE):
				name = clean_name(m)
				if is_valid_name(name) and name not in found_senders:
					found_senders.append(name)

		# === ตรวจ keyword พิเศษที่ช่วยระบุประเภทได้ชัด ===
		is_topup = bool(re.search(r'เติมเงิน(สำเร็จ)?', text))  # เติมเงินสำเร็จ = มีคนเติมให้เรา
		is_receive = bool(re.search(r'(รับเงิน|ได้รับ|เงินเข้า)', text))

		# --- กำหนด transaction type จาก Keywords (ใช้เป็น fallback เท่านั้น) ---
		# ไม่ใช้ keyword เป็นหลักเพราะ "โอนเงินให้" อาจเป็นรายรับถ้าผู้รับคือเรา
		type_keywords = {
			'income': ['รับเงิน', 'รับโอน', 'เงินเข้า', 'Received', 'ได้รับ', 'Income', 'เข้าบัญชี', 'Deposit', 'รับจาก'],
			'expense': ['จ่ายเงิน', 'ชำระ', 'Payment', 'Paid', 'ถอน', 'ออกจากบัญชี', 'Withdrawal', 'จ่าย', 'ชำระเงิน'],
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

		# --- เปรียบเทียบชื่อกับ user เพื่อระบุประเภท ---
		user = request.user if request.user.is_authenticated else None
		user_fullname = None
		user_firstname = None
		user_lastname = None
		match_status = None
		match_detail = None
		match_confidence = None
		suggested_type = detected_type or 'expense'
		suggested_account_name = ''
		receiver_name = found_receivers[0] if found_receivers else ''
		sender_name = found_senders[0] if found_senders else ''
		
		def normalize(s):
			if not s: return ''
			s = s.replace('.', '').strip()
			s = re.sub(r'^(นาย|นาง|นางสาว|น\.?ส\.?|Mr|Mrs|Ms)\.?\s*', '', s, flags=re.IGNORECASE)
			return ' '.join(s.lower().split())
		
		def similarity_ratio(s1, s2):
			return SequenceMatcher(None, s1, s2).ratio()
		
		def check_name_match(slip_name, user_first, user_last):
			"""
			ตรวจสอบว่าชื่อตรงกับ user หรือไม่ และเป็นชื่อเต็มหรือย่อ
			Returns: (is_match, is_full_name)
			- is_match: ชื่อตรงกับ user หรือไม่
			- is_full_name: เป็นชื่อเต็ม (ชื่อ + นามสกุลเต็ม) หรือไม่
			"""
			if not slip_name or not user_first:
				return (False, False)
			
			slip_norm = normalize(slip_name)
			user_first_norm = normalize(user_first)
			user_last_norm = normalize(user_last) if user_last else ''
			user_full_norm = f"{user_first_norm} {user_last_norm}".strip()
			
			slip_parts = slip_norm.split()
			if not slip_parts:
				return (False, False)
			
			slip_first = slip_parts[0]
			slip_last = slip_parts[1] if len(slip_parts) > 1 else ''
			
			# Case 1: Full exact match = ชื่อเต็ม
			if slip_norm == user_full_norm:
				return (True, True)
			
			# Case 2: High similarity (>= 85%) = ชื่อเต็ม
			if similarity_ratio(slip_norm, user_full_norm) >= 0.85:
				return (True, True)
			
			# Case 3: First name exact + last name full = ชื่อเต็ม
			if slip_first == user_first_norm and slip_last == user_last_norm:
				return (True, True)
			
			# Case 4: First name match + last name abbreviated (1-2 chars) = ชื่อย่อ
			if slip_first == user_first_norm:
				if not slip_last:
					return (True, False)  # มีแค่ชื่อ ไม่มีนามสกุล = ย่อ
				if len(slip_last) <= 2:
					return (True, False)  # นามสกุลย่อ เช่น "ว" หรือ "วี"
				if user_last_norm and slip_last != user_last_norm:
					# นามสกุลไม่ตรงเต็ม เช็คว่าย่อหรือเปล่า
					if user_last_norm.startswith(slip_last) or slip_last.endswith('.'):
						return (True, False)  # นามสกุลย่อ
					# ถ้า similarity สูงพอก็ถือว่าเต็ม
					if similarity_ratio(slip_last, user_last_norm) >= 0.8:
						return (True, True)
					return (True, False)  # ไม่แน่ใจ ถือว่าย่อ
				return (True, True)  # นามสกุลเต็ม
			
			# Case 5: First name starts with = ชื่อย่อ
			if user_first_norm.startswith(slip_first) and len(slip_first) >= 2:
				return (True, False)
			
			return (False, False)
		
		if user:
			user_firstname = user.first_name
			user_lastname = user.last_name
			user_fullname = f"{user_firstname} {user_lastname}".strip()
			
			# === Logic ใหม่: ดูจากชื่อเต็ม/ย่อ ===
			# - ชื่อเราเต็ม = เขาโอนให้เรา = รายรับ
			# - ชื่อเราย่อ = เราโอนให้เขา = รายจ่าย (ชื่อผู้รับจะเต็ม)
			
			# หาชื่อที่ตรงกับ user จากทุก field
			all_names = []
			for name in found_receivers:
				is_match, is_full = check_name_match(name, user_firstname, user_lastname)
				if is_match:
					all_names.append({'name': name, 'is_full': is_full, 'source': 'receiver'})
			for name in found_senders:
				is_match, is_full = check_name_match(name, user_firstname, user_lastname)
				if is_match:
					all_names.append({'name': name, 'is_full': is_full, 'source': 'sender'})
			for name in found_names:
				is_match, is_full = check_name_match(name, user_firstname, user_lastname)
				if is_match:
					all_names.append({'name': name, 'is_full': is_full, 'source': 'general'})
			
			if all_names:
				# หาชื่อที่เป็น full name ก่อน
				full_name_match = next((n for n in all_names if n['is_full']), None)
				any_match = all_names[0]
				
				if full_name_match:
					# พบชื่อเราแบบเต็ม = เขาโอนให้เรา = รายรับ
					suggested_type = 'income'
					type_confidence = 'full_name_match'
					match_status = True
					match_detail = f'พบชื่อเต็ม: {full_name_match["name"]} (รายรับ)'
					# account_name = ชื่อคนที่โอนให้เรา (ถ้าหาได้)
					other_names = [n for n in found_names + found_senders + found_receivers 
								   if not check_name_match(n, user_firstname, user_lastname)[0]]
					suggested_account_name = other_names[0] if other_names else user_fullname
				else:
					# พบชื่อเราแบบย่อ = เราโอนให้เขา = รายจ่าย
					suggested_type = 'expense'
					type_confidence = 'abbreviated_name_match'
					match_status = True
					match_detail = f'พบชื่อย่อ: {any_match["name"]} (รายจ่าย)'
					# account_name = ชื่อผู้รับ (คนที่เราโอนให้)
					other_names = [n for n in found_names + found_receivers 
								   if not check_name_match(n, user_firstname, user_lastname)[0]]
					suggested_account_name = other_names[0] if other_names else receiver_name
			else:
				# === ไม่พบชื่อเราในสลิปเลย = ไม่สามารถระบุได้แน่นอน ===
				# Default เป็น expense แต่ให้ warning ให้ user ตรวจสอบ
				match_status = False
				match_confidence = 'no_match'
				
				# หา account_name จากชื่อที่พบ
				if sender_name:
					suggested_account_name = sender_name
					match_detail = f'พบผู้โอน: {sender_name} (ไม่พบชื่อผู้ใช้)'
				elif receiver_name:
					suggested_account_name = receiver_name
					match_detail = f'พบผู้รับ: {receiver_name} (ไม่พบชื่อผู้ใช้)'
				elif found_names:
					suggested_account_name = found_names[0]
					match_detail = f'พบชื่อ: {found_names[0]} (ไม่พบชื่อผู้ใช้)'
				else:
					suggested_account_name = ''
					match_detail = 'ไม่พบชื่อในสลิป'
				
				# Default type = expense แต่ confidence ต่ำ
				suggested_type = 'expense'
				type_confidence = 'uncertain'
		
		# สร้าง warning ถ้าไม่สามารถระบุประเภทได้แน่นอน
		type_warning = None
		is_valid_slip = True
		
		# ตรวจสอบว่าเป็น slip หรือไม่
		if not found_amount and not found_names and not found_receivers and not found_senders:
			type_warning = 'ไม่พบข้อมูลสลิป อาจไม่ใช่รูปสลิปโอนเงิน'
			is_valid_slip = False
			suggested_type = None  # ไม่ระบุประเภทเมื่อไม่ใช่ slip
		elif not found_amount:
			type_warning = 'ไม่พบจำนวนเงินในรูป กรุณากรอกข้อมูลเอง'
			is_valid_slip = False
			suggested_type = None  # ไม่ระบุประเภทเมื่อไม่พบจำนวนเงิน
		elif type_confidence == 'uncertain':
			type_warning = 'ไม่พบชื่อผู้ใช้ในสลิป กรุณาเลือกประเภทรายการเอง'
		elif not match_status:
			type_warning = 'ไม่พบชื่อผู้ใช้ในสลิป กรุณาตรวจสอบประเภทรายการ'

		return Response({
			'text': text,
			'found_names': found_names,
			'found_receivers': found_receivers,  # ชื่อผู้รับที่พบ
			'found_senders': found_senders,  # ชื่อผู้โอนที่พบ
			'user_fullname': user_fullname,
			'match': match_status,
			'match_detail': match_detail,
			'match_confidence': match_confidence,
			'is_valid_slip': is_valid_slip,
			# ข้อมูลที่ดึงได้
			'extracted': {
				'account_name': suggested_account_name,
				'receiver_name': receiver_name,  # ชื่อผู้รับ
				'sender_name': sender_name,  # ชื่อผู้โอน
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
	html = """
	<!DOCTYPE html>
	<html lang="th">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>404 - Not Found</title>
		<style>
			* { margin: 0; padding: 0; box-sizing: border-box; }
			body {
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
				min-height: 100vh;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #fff;
				overflow: hidden;
			}
			.container {
				text-align: center;
				padding: 40px;
				position: relative;
				z-index: 1;
			}
			.error-code {
				font-size: 150px;
				font-weight: 900;
				background: linear-gradient(45deg, #ff6b6b, #ee5a5a, #ff8e8e);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
				text-shadow: 0 0 80px rgba(255, 107, 107, 0.5);
				animation: pulse 2s ease-in-out infinite;
			}
			@keyframes pulse {
				0%, 100% { opacity: 1; transform: scale(1); }
				50% { opacity: 0.8; transform: scale(1.02); }
			}
			.icon {
				font-size: 80px;
				margin-bottom: 20px;
				animation: shake 0.5s ease-in-out infinite;
			}
			@keyframes shake {
				0%, 100% { transform: rotate(0deg); }
				25% { transform: rotate(-5deg); }
				75% { transform: rotate(5deg); }
			}
			h1 {
				font-size: 32px;
				margin: 20px 0;
				color: #ff6b6b;
			}
			p {
				font-size: 18px;
				color: #888;
				margin-bottom: 30px;
				max-width: 400px;
			}
			.warning-tape {
				position: fixed;
				width: 200%;
				height: 40px;
				background: repeating-linear-gradient(
					45deg,
					#ff6b6b,
					#ff6b6b 20px,
					#1a1a2e 20px,
					#1a1a2e 40px
				);
				opacity: 0.3;
			}
			.tape-top { top: 50px; left: -50%; transform: rotate(-5deg); }
			.tape-bottom { bottom: 50px; left: -50%; transform: rotate(5deg); }
			.lock-icon {
				width: 100px;
				height: 100px;
				margin: 0 auto 20px;
				position: relative;
			}
			.lock-body {
				width: 60px;
				height: 50px;
				background: #ff6b6b;
				border-radius: 8px;
				margin: 0 auto;
				position: relative;
			}
			.lock-shackle {
				width: 40px;
				height: 30px;
				border: 8px solid #ff6b6b;
				border-bottom: none;
				border-radius: 20px 20px 0 0;
				margin: 0 auto;
				position: relative;
				top: 8px;
			}
			.particles {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				pointer-events: none;
				overflow: hidden;
			}
			.particle {
				position: absolute;
				width: 4px;
				height: 4px;
				background: #ff6b6b;
				border-radius: 50%;
				opacity: 0.5;
				animation: float 15s infinite;
			}
			@keyframes float {
				0%, 100% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
				10% { opacity: 0.5; }
				90% { opacity: 0.5; }
				100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
			}
		</style>
	</head>
	<body>
		<div class="warning-tape tape-top"></div>
		<div class="warning-tape tape-bottom"></div>
		<div class="particles">
			<div class="particle" style="left: 10%; animation-delay: 0s;"></div>
			<div class="particle" style="left: 20%; animation-delay: 2s;"></div>
			<div class="particle" style="left: 30%; animation-delay: 4s;"></div>
			<div class="particle" style="left: 40%; animation-delay: 1s;"></div>
			<div class="particle" style="left: 50%; animation-delay: 3s;"></div>
			<div class="particle" style="left: 60%; animation-delay: 5s;"></div>
			<div class="particle" style="left: 70%; animation-delay: 2.5s;"></div>
			<div class="particle" style="left: 80%; animation-delay: 1.5s;"></div>
			<div class="particle" style="left: 90%; animation-delay: 4.5s;"></div>
		</div>
		<div class="container">
			<div class="lock-icon">
				<div class="lock-shackle"></div>
				<div class="lock-body"></div>
			</div>
			<div class="error-code">404</div>
			<h1>🚫 ACCESS DENIED</h1>
			<p>ไม่พบหน้าที่คุณต้องการ หรือคุณไม่มีสิทธิ์เข้าถึงส่วนนี้</p>
		</div>
	</body>
	</html>
	"""
	return HttpResponse(html, status=404, content_type='text/html')