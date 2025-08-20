# Supabase Backup System Configuration Guide

This guide provides comprehensive instructions for setting up independent backup systems for your Supabase project, following the latest 2025 best practices.

## Overview

While Supabase provides automated daily backups on the hosted platform, implementing additional backup strategies is crucial for production applications. This guide covers:

1. **Point-in-Time Recovery (PITR)** - Enable for databases over 4GB
2. **Manual Backup Scripts** - For scheduled and on-demand backups
3. **Off-platform Storage** - Store backups in multiple locations
4. **Backup Verification** - Ensure backup integrity
5. **Disaster Recovery Planning** - Complete restoration procedures

## 1. Enable Point-in-Time Recovery (PITR)

### Prerequisites
- Supabase Pro Plan or higher
- Database size > 4GB (recommended)

### Steps
1. Go to your Supabase Dashboard
2. Navigate to Settings > Database
3. Enable Point-in-Time Recovery
4. Configure retention period (7-30 days recommended)

### Benefits
- Restore to any point in time within the retention window
- Automatic continuous archiving
- Zero data loss recovery

## 2. Automated Backup Scripts

### Database Backup Script

Create a backup script using `pg_dump`:

```bash
#!/bin/bash
# backup-database.sh

# Configuration
DB_HOST="your-project-ref.supabase.co"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD="your-database-password"
BACKUP_DIR="/backups/supabase"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${DATE}.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
PGPASSWORD=$DB_PASSWORD pg_dump \
  --host=$DB_HOST \
  --port=5432 \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --no-password \
  --verbose \
  --clean \
  --no-owner \
  --no-privileges \
  --format=custom \
  --file=$BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage (example with AWS S3)
aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/database/

# Clean up old local backups (keep last 7 days)
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

### Schema-Only Backup

```bash
#!/bin/bash
# backup-schema.sh

PGPASSWORD=$DB_PASSWORD pg_dump \
  --host=$DB_HOST \
  --port=5432 \
  --username=$DB_USER \
  --dbname=$DB_NAME \
  --no-password \
  --schema-only \
  --clean \
  --format=plain \
  --file="${BACKUP_DIR}/schema_${DATE}.sql"
```

### Cron Configuration

Add to your crontab for automated backups:

```cron
# Daily backup at 2 AM
0 2 * * * /path/to/backup-database.sh >> /var/log/backup.log 2>&1

# Weekly schema backup on Sundays at 1 AM
0 1 * * 0 /path/to/backup-schema.sh >> /var/log/backup.log 2>&1

# Monthly full backup on 1st day at 3 AM
0 3 1 * * /path/to/backup-full.sh >> /var/log/backup.log 2>&1
```

## 3. Edge Function Backup

Create a script to backup your Edge Functions:

```bash
#!/bin/bash
# backup-functions.sh

FUNCTIONS_DIR="/path/to/supabase/functions"
BACKUP_DIR="/backups/supabase/functions"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
tar -czf "${BACKUP_DIR}/functions_${DATE}.tar.gz" -C "$FUNCTIONS_DIR" .

# Upload to cloud storage
aws s3 cp "${BACKUP_DIR}/functions_${DATE}.tar.gz" s3://your-backup-bucket/functions/
```

## 4. Storage Bucket Backup

Backup your Supabase storage buckets:

```bash
#!/bin/bash
# backup-storage.sh

# Using Supabase CLI
supabase storage download --recursive your-bucket-name ./storage-backup/

# Sync to cloud storage
aws s3 sync ./storage-backup/ s3://your-backup-bucket/storage/
```

## 5. Configuration Backup

Backup your Supabase configuration:

```bash
#!/bin/bash
# backup-config.sh

CONFIG_DIR="/path/to/supabase"
BACKUP_DIR="/backups/supabase/config"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup configuration files
tar -czf "${BACKUP_DIR}/config_${DATE}.tar.gz" \
  "$CONFIG_DIR/config.toml" \
  "$CONFIG_DIR/migrations/" \
  "$CONFIG_DIR/seed.sql" \
  "$CONFIG_DIR/.env.example"

# Upload to cloud storage
aws s3 cp "${BACKUP_DIR}/config_${DATE}.tar.gz" s3://your-backup-bucket/config/
```

## 6. Backup Verification Script

```bash
#!/bin/bash
# verify-backup.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Test backup integrity
if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
  echo "✅ Backup integrity verified: $BACKUP_FILE"
else
  echo "❌ Backup integrity check failed: $BACKUP_FILE"
  exit 1
fi

# Optional: Test restore to temporary database
# createdb temp_restore_test
# pg_restore -d temp_restore_test "$BACKUP_FILE"
# dropdb temp_restore_test
```

## 7. Disaster Recovery Procedure

### Complete Database Restoration

```bash
#!/bin/bash
# restore-database.sh

BACKUP_FILE=$1
TARGET_DB="restored_database"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Create target database
createdb $TARGET_DB

# Restore from backup
pg_restore \
  --host=$DB_HOST \
  --port=5432 \
  --username=$DB_USER \
  --dbname=$TARGET_DB \
  --no-password \
  --verbose \
  --clean \
  --if-exists \
  "$BACKUP_FILE"

echo "Database restored to: $TARGET_DB"
```

## 8. Monitoring and Alerting

Create a monitoring script for backup health:

```bash
#!/bin/bash
# monitor-backups.sh

BACKUP_DIR="/backups/supabase"
MAX_AGE_HOURS=26  # Alert if no backup in last 26 hours

# Check for recent backups
LATEST_BACKUP=$(find $BACKUP_DIR -name "backup_*.sql.gz" -mtime -1 | wc -l)

if [ "$LATEST_BACKUP" -eq 0 ]; then
  echo "❌ ALERT: No recent database backups found!"
  # Send alert (email, Slack, etc.)
  # curl -X POST -H 'Content-type: application/json' \
  #   --data '{"text":"🚨 Backup Alert: No recent database backups found!"}' \
  #   YOUR_SLACK_WEBHOOK_URL
  exit 1
else
  echo "✅ Recent backup found"
fi

# Verify backup integrity
LATEST_FILE=$(ls -t $BACKUP_DIR/backup_*.sql.gz | head -1)
gunzip -t "$LATEST_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Latest backup integrity verified"
else
  echo "❌ ALERT: Latest backup integrity check failed!"
  exit 1
fi
```

## 9. Cloud Storage Configuration

### AWS S3 Setup

```bash
# Configure AWS CLI
aws configure

# Create backup bucket with versioning
aws s3 mb s3://your-backup-bucket
aws s3api put-bucket-versioning \
  --bucket your-backup-bucket \
  --versioning-configuration Status=Enabled

# Set lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-backup-bucket \
  --lifecycle-configuration file://lifecycle-policy.json
```

### Google Cloud Storage Setup

```bash
# Create bucket
gsutil mb gs://your-backup-bucket

# Enable versioning
gsutil versioning set on gs://your-backup-bucket

# Set lifecycle
gsutil lifecycle set lifecycle.json gs://your-backup-bucket
```

## 10. Security Considerations

### Encryption
- Always encrypt backups in transit and at rest
- Use strong passwords for database connections
- Rotate backup credentials regularly
- Store credentials securely (AWS Secrets Manager, etc.)

### Access Control
- Limit backup script execution to specific users
- Use IAM roles for cloud storage access
- Implement audit logging for backup operations
- Regular access reviews

## 11. Testing and Validation

### Regular Restore Testing
- Monthly restore tests to verify backup integrity
- Document restore procedures and timelines
- Test disaster recovery scenarios
- Validate data consistency after restore

### Backup Monitoring Dashboard

Create a simple dashboard to monitor backup health:

```sql
-- Monitor backup frequency
SELECT 
  DATE(created_at) as backup_date,
  COUNT(*) as backup_count
FROM backup_log 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY backup_date DESC;

-- Check backup sizes for anomalies
SELECT 
  backup_file,
  size_mb,
  created_at,
  CASE 
    WHEN size_mb < 100 THEN 'Small (potential issue)'
    WHEN size_mb > 10000 THEN 'Large (check for data growth)'
    ELSE 'Normal'
  END as status
FROM backup_log 
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## 12. Compliance and Retention

### GDPR Considerations
- Implement data retention policies
- Provide mechanisms for data deletion
- Document backup locations and access

### Retention Policies
- Daily backups: 30 days
- Weekly backups: 12 weeks  
- Monthly backups: 12 months
- Yearly backups: 7 years (or as required by compliance)

## Emergency Contacts

Document key contacts for disaster recovery:
- Database Administrator: [contact info]
- System Administrator: [contact info] 
- Cloud Provider Support: [contact info]
- Management/Decision Makers: [contact info]

## Recovery Time Objectives (RTO) / Recovery Point Objectives (RPO)

Define your targets:
- **RPO**: Maximum acceptable data loss (e.g., 1 hour)
- **RTO**: Maximum acceptable downtime (e.g., 4 hours)
- Test regularly to ensure these targets are met

---

## Implementation Checklist

- [ ] Enable PITR in Supabase Dashboard
- [ ] Create backup scripts with error handling
- [ ] Set up cloud storage for off-site backups  
- [ ] Configure automated backup scheduling (cron)
- [ ] Implement backup verification processes
- [ ] Create disaster recovery procedures
- [ ] Set up monitoring and alerting
- [ ] Test restore procedures monthly
- [ ] Document all processes and contacts
- [ ] Train team members on recovery procedures
- [ ] Review and update backup strategy quarterly

This comprehensive backup strategy ensures your Dungeon Whisperer application has robust data protection and quick recovery capabilities following Supabase best practices for 2025.