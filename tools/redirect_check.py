import requests
import sys

urls = ['https://slipshot.vercel.app/api/users/me/', 'https://slipshot.vercel.app/api/users/me']
for url in urls:
    print('\nRequesting:', url)
    try:
        r = requests.get(url, allow_redirects=False, timeout=30)
    except Exception as e:
        print('ERROR', e)
        continue

    print('Status:', r.status_code)
    print('Location header:', r.headers.get('Location'))
    print('Response headers:')
    for k, v in r.headers.items():
        print(f'  {k}: {v}')
    print('Body preview:', r.text[:200])
