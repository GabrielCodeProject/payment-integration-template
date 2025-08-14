#!/bin/bash
# SSL Certificate Generation Script for PostgreSQL
# Creates self-signed certificates for development and provides production guidance

set -e

# Configuration
SSL_DIR="./database/ssl"
CERT_DAYS=365
KEY_SIZE=2048
COUNTRY="US"
STATE="CA"
CITY="San Francisco"
ORG="Payment Template"
UNIT="Development"
COMMON_NAME="postgres"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 PostgreSQL SSL Certificate Generation${NC}"
echo "==============================================="

# Create SSL directory
mkdir -p "$SSL_DIR"
cd "$SSL_DIR"

# Generate CA private key
echo -e "${YELLOW}Generating CA private key...${NC}"
openssl genrsa -out ca-key.pem "$KEY_SIZE"

# Generate CA certificate
echo -e "${YELLOW}Generating CA certificate...${NC}"
openssl req -new -x509 -key ca-key.pem -out ca-cert.pem -days "$CERT_DAYS" -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$UNIT/CN=PostgreSQL-CA"

# Generate server private key
echo -e "${YELLOW}Generating server private key...${NC}"
openssl genrsa -out server-key.pem "$KEY_SIZE"

# Generate server certificate signing request
echo -e "${YELLOW}Generating server CSR...${NC}"
openssl req -new -key server-key.pem -out server-req.pem -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$UNIT/CN=$COMMON_NAME"

# Generate server certificate signed by CA
echo -e "${YELLOW}Generating server certificate...${NC}"
openssl x509 -req -in server-req.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -days "$CERT_DAYS"

# Generate client private key
echo -e "${YELLOW}Generating client private key...${NC}"
openssl genrsa -out client-key.pem "$KEY_SIZE"

# Generate client certificate signing request
echo -e "${YELLOW}Generating client CSR...${NC}"
openssl req -new -key client-key.pem -out client-req.pem -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG/OU=$UNIT/CN=app_user"

# Generate client certificate signed by CA
echo -e "${YELLOW}Generating client certificate...${NC}"
openssl x509 -req -in client-req.pem -CA ca-cert.pem -CAkey ca-key.pem -CAcreateserial -out client-cert.pem -days "$CERT_DAYS"

# Set appropriate permissions
echo -e "${YELLOW}Setting secure permissions...${NC}"
chmod 600 *-key.pem
chmod 644 *-cert.pem ca-cert.pem

# Remove CSR files
rm -f *-req.pem

# Create DH parameters for enhanced security
echo -e "${YELLOW}Generating DH parameters (this may take a while)...${NC}"
openssl dhparam -out dh2048.pem 2048

echo -e "${GREEN}✅ SSL certificates generated successfully!${NC}"
echo ""
echo "Files created:"
echo "  - ca-cert.pem      (Certificate Authority)"
echo "  - ca-key.pem       (CA Private Key)"
echo "  - server-cert.pem  (Server Certificate)"
echo "  - server-key.pem   (Server Private Key)"
echo "  - client-cert.pem  (Client Certificate)"
echo "  - client-key.pem   (Client Private Key)"
echo "  - dh2048.pem       (DH Parameters)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "1. These are self-signed certificates for DEVELOPMENT only"
echo "2. For PRODUCTION, use certificates from a trusted CA"
echo "3. Keep private keys secure and never commit to version control"
echo "4. Rotate certificates regularly (recommended: every 90 days)"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Update PostgreSQL configuration to enable SSL"
echo "2. Update connection strings to use SSL"
echo "3. Test SSL connections"