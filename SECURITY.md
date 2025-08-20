# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security reports to: [security@dungeon-whisperer.com] (or create a private issue)
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact
   - Any suggested fixes (if applicable)

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Status Update**: Weekly updates on investigation progress
- **Resolution**: Security patches released within 14 days for critical issues

### Security Measures

This project implements several security measures:

- Input validation and sanitization
- Authentication required for all API endpoints
- Secure error handling (no sensitive data exposure)
- Production security headers
- Rate limiting protection
- XSS protection through content sanitization

### Security Features

- **Authentication**: Supabase Auth with email verification
- **Authorization**: Row Level Security (RLS) policies
- **Input Validation**: Server-side validation for all user inputs
- **Error Handling**: Secure error messages without information leakage
- **Monitoring**: Security monitoring and logging

### Responsible Disclosure

We follow responsible disclosure practices:

1. Report received and acknowledged
2. Issue investigated and verified
3. Fix developed and tested
4. Security advisory published (if applicable)
5. Credit given to reporter (with permission)

## Security Contact

For security-related questions or reports, contact us through:
- Security email: [Configure your security contact]
- GitHub Security Advisories (preferred for vulnerabilities)

Thank you for helping keep Dungeon Whisperer secure!