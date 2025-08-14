#!/usr/bin/env python3
"""
PostgreSQL SCRAM-SHA-256 Password Hash Generator for PgBouncer
Generates secure password hashes for PgBouncer authentication

Usage:
    python3 generate-pgbouncer-passwords.py
"""

import hashlib
import secrets
import base64
import hmac

def generate_scram_sha256_hash(password: str, salt: bytes = None, iterations: int = 4096) -> str:
    """
    Generate SCRAM-SHA-256 hash compatible with PostgreSQL and PgBouncer
    
    Args:
        password: Plain text password
        salt: Salt bytes (generated if None)
        iterations: Number of iterations for PBKDF2
        
    Returns:
        SCRAM-SHA-256 formatted hash string
    """
    if salt is None:
        salt = secrets.token_bytes(16)
    
    # Normalize password
    password_bytes = password.encode('utf-8')
    
    # Generate salted password using PBKDF2
    salted_password = hashlib.pbkdf2_hmac('sha256', password_bytes, salt, iterations)
    
    # Generate client key
    client_key = hmac.new(salted_password, b'Client Key', hashlib.sha256).digest()
    
    # Generate stored key (SHA256 of client key)
    stored_key = hashlib.sha256(client_key).digest()
    
    # Generate server key
    server_key = hmac.new(salted_password, b'Server Key', hashlib.sha256).digest()
    
    # Encode components
    salt_b64 = base64.b64encode(salt).decode('ascii')
    stored_key_b64 = base64.b64encode(stored_key).decode('ascii')
    server_key_b64 = base64.b64encode(server_key).decode('ascii')
    
    # Format as SCRAM-SHA-256 hash
    return f"SCRAM-SHA-256${iterations}:{salt_b64}${stored_key_b64}:{server_key_b64}"

def main():
    """Generate SCRAM-SHA-256 hashes for all PgBouncer users"""
    
    # User credentials (use environment variables in production)
    users = {
        'app_readwrite': 'secure_app_password_2024',
        'app_readonly': 'secure_readonly_password_2024',
        'pgbouncer_admin': 'secure_pgbouncer_admin_2024',
        'pgbouncer_monitor': 'secure_pgbouncer_monitor_2024'
    }
    
    print("# PgBouncer User Authentication File")
    print("# Generated SCRAM-SHA-256 hashes for secure authentication")
    print("# Format: \"username\" \"SCRAM-SHA-256$iterations:salt$storedkey:serverkey\"")
    print("")
    
    for username, password in users.items():
        # Generate unique salt for each user
        hash_value = generate_scram_sha256_hash(password)
        print(f'"{username}" "{hash_value}"')
    
    print("")
    print("# SECURITY NOTES:")
    print("# 1. Store this file with 600 permissions (readable only by owner)")
    print("# 2. Keep passwords secure and rotate regularly")
    print("# 3. Use environment variables for passwords in production")
    print("# 4. Monitor authentication logs for security events")

if __name__ == "__main__":
    main()