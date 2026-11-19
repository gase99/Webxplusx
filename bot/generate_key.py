"""Generate a deployment key; never overwrite an existing private key."""
import json
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from bot import encode

key = ec.generate_private_key(ec.SECP256R1())
path = Path(__file__).with_name('private.pem')
with path.open('xb') as f:
    path.chmod(0o600)
    f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
n = key.public_key().public_numbers()
print(json.dumps(dict(kty='EC', crv='P-256', x=encode(n.x.to_bytes(32, 'big')), y=encode(n.y.to_bytes(32, 'big')))))
