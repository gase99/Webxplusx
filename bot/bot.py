"""Single-process long polling bot. Secrets come from environment, never from clients."""
import base64
import json
import os
import re
import sqlite3
import time
import uuid
import urllib.request
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils


def encode(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def issue(private_key, device):
    payload = json.dumps(dict(v=1, id=str(uuid.uuid4()), device=device,
                              iat=int(time.time()), exp=None), separators=(',', ':')).encode()
    der = private_key.sign(payload, ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    return encode(payload) + '.' + encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))


def main():
    token = os.environ['TELEGRAM_BOT_TOKEN']
    admin = int(os.environ['TELEGRAM_ADMIN_ID'])
    with open(os.environ.get('LICENSE_PRIVATE_KEY', 'bot/private.pem'), 'rb') as f:
        private = serialization.load_pem_private_key(f.read(), password=None)
    if not isinstance(private, ec.EllipticCurvePrivateKey) or not isinstance(private.curve, ec.SECP256R1):
        raise ValueError('P-256 private key required')
    db = sqlite3.connect(os.environ.get('BOT_DATABASE', 'bot/licenses.sqlite'))
    db.execute('CREATE TABLE IF NOT EXISTS requests (id INTEGER PRIMARY KEY, chat INTEGER, device TEXT, status TEXT DEFAULT "pending", license TEXT)')
    db.execute('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, offset INTEGER)')
    db.commit()

    def api(method, **args):
        req = urllib.request.Request('https://api.telegram.org/bot' + token + '/' + method,
                                     data=json.dumps(args).encode(), headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=45) as response:
            result = json.load(response)
        if not result.get('ok'):
            raise RuntimeError('Telegram request failed')
        return result['result']

    def send(chat, text, **kwargs):
        return api('sendMessage', chat_id=chat, text=text, **kwargs)

    def handle(update):
        callback = update.get('callback_query')
        if callback:
            if callback['from']['id'] != admin:
                api('answerCallbackQuery', callback_query_id=callback['id'], text='دسترسی ندارید')
                return
            match = re.fullmatch(r'(approve|reject):(\d+)', callback.get('data', ''))
            if not match:
                return
            action, rid = match.groups()
            row = db.execute('SELECT chat,device,status,license FROM requests WHERE id=?', (rid,)).fetchone()
            if row:
                chat, device, status, license_key = row
                if status == 'pending':
                    status = 'approved' if action == 'approve' else 'rejected'
                    license_key = issue(private, device) if status == 'approved' else None
                    db.execute('UPDATE requests SET status=?,license=? WHERE id=?', (status, license_key, rid))
                    db.commit()
                # Repeated approval resends the SAME key, never generates a second one.
                send(chat, 'لایسنس شما (در برنامه کپی کنید):\n' + license_key if status == 'approved' else 'درخواست شما رد شد؛ با مدیر تماس بگیرید.')
            api('answerCallbackQuery', callback_query_id=callback['id'], text='انجام شد')
            return
        msg = update.get('message', {})
        chat = msg.get('chat', {})
        if chat.get('type') != 'private':
            return
        chat_id = chat['id']
        text = msg.get('text', '').strip()
        if text.startswith('/start'):
            send(chat_id, 'برای خرید لایسنس، شناسهٔ دستگاه را از صفحهٔ قفل برنامه کپی و اینجا ارسال کنید.\n' + os.environ.get('PAYMENT_INSTRUCTIONS', 'برای پرداخت با مدیر هماهنگ کنید.'))
        elif re.fullmatch(r'[a-zA-Z0-9-]{16,80}', text):
            existing = db.execute('SELECT status,license FROM requests WHERE chat=? AND device=? ORDER BY id DESC LIMIT 1', (chat_id, text)).fetchone()
            if existing and existing[0] == 'approved':
                send(chat_id, existing[1])
                return
            if existing and existing[0] == 'pending':
                send(chat_id, 'درخواست قبلی شما در انتظار تأیید مدیر است.')
                return
            pending = db.execute('SELECT count(*) FROM requests WHERE chat=? AND status="pending"', (chat_id,)).fetchone()[0]
            if pending >= 3:
                send(chat_id, 'لطفاً منتظر بررسی درخواست‌های قبلی بمانید.')
                return
            rid = db.execute('INSERT INTO requests(chat,device) VALUES (?,?)', (chat_id, text)).lastrowid
            db.commit()
            send(admin, f'درخواست خرید #{rid}\nکاربر: {chat_id}\nدستگاه: {text}\nپس از بررسی پرداخت تأیید کنید.', reply_markup={'inline_keyboard': [[{'text': 'تأیید و صدور', 'callback_data': f'approve:{rid}'}, {'text': 'رد', 'callback_data': f'reject:{rid}'}]]})
            send(chat_id, 'درخواست ثبت شد. پس از بررسی پرداخت و تأیید مدیر، لایسنس همین‌جا ارسال می‌شود.')
        else:
            send(chat_id, 'شناسهٔ دستگاه را از برنامه کپی کنید. برای راهنما /start را بفرستید.')

    while True:
        try:
            row = db.execute('SELECT offset FROM state WHERE id=1').fetchone()
            for update in api('getUpdates', offset=row[0] if row else 0, timeout=30, allowed_updates=['message', 'callback_query']):
                handle(update)
                db.execute('INSERT OR REPLACE INTO state VALUES (1,?)', (update['update_id'] + 1,))
                db.commit()
        except Exception:
            # Never log URLs: Telegram URLs contain the secret token.
            print('Bot operation failed; retrying in 5 seconds', flush=True)
            time.sleep(5)


if __name__ == '__main__':
    main()
