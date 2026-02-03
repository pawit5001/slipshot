import requests

BASE = 'https://slipshot-backend.onrender.com'
HEADERS = {'Origin': 'https://slipshot.vercel.app', 'Content-Type': 'application/json'}

s = requests.Session()
try:
    print('POST /api/auth/token/cookie/')
    r = s.post(f'{BASE}/api/auth/token/cookie/', json={'username':'admin','password':'0858020458Za*'}, headers=HEADERS, timeout=10)
    print(r.status_code)
    print(r.headers.get('Set-Cookie'))
    try:
        print(r.json())
    except Exception:
        print(r.text)

    print('\nGET /api/debug/cookies/')
    r = s.get(f'{BASE}/api/debug/cookies/', headers={'Origin': 'https://slipshot.vercel.app'}, timeout=10)
    print(r.status_code)
    print(r.text)

    print('\nGET /api/users/me/')
    r = s.get(f'{BASE}/api/users/me/', headers={'Origin': 'https://slipshot.vercel.app'}, timeout=10)
    print(r.status_code)
    print(r.text)

    print('\nPOST /api/auth/token/refresh/')
    r = s.post(f'{BASE}/api/auth/token/refresh/', headers={'Origin': 'https://slipshot.vercel.app'}, timeout=10)
    print(r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)

except Exception as e:
    print('ERROR', e)
