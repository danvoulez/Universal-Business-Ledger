# Environment Variables Guide

## Local Development (.env)

Create a `.env` file in the root directory with your configuration.

### Required Variables

```bash
# Server
PORT=3000
HOST=0.0.0.0

# LLM Providers (at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY...
GEMINI_API_KEY=...
```

### Optional Variables

```bash
# Database (when using PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# AWS S3 (for file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# Auth0 (for authentication)
AUTH0_DOMAIN=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
```

## Render Deployment

Set environment variables in the Render dashboard:

1. Go to your service
2. Click "Environment"
3. Add variables

### Required for Antenna Service

- `PORT` (auto-set by Render)
- `NODE_ENV=production`
- `DATABASE_URL` (from PostgreSQL service)
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

### Optional

- `REDIS_URL` (from Redis service)
- `AWS_*` (if using S3)
- `AUTH0_*` (if using Auth0)

## Security Best Practices

1. ✅ **Never commit `.env` to git** (it's in `.gitignore`)
2. ✅ **Use `.env.example`** as a template
3. ✅ **Rotate API keys** regularly
4. ✅ **Use Render's secrets** for production
5. ✅ **Limit AWS credentials** to specific buckets/regions

## AWS Credentials

### When Do You Need AWS?

Only if you're using **S3 for file storage**:
- Workspace files
- Document attachments
- Exports

### If Not Using S3

You can remove AWS credentials entirely. The UBL works without S3.

### AWS Setup (if needed)

1. Create S3 bucket
2. Create IAM user with S3 permissions
3. Generate access keys
4. Add to `.env` or Render environment variables

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket-name
```

## Migration from Old .env

If you had credentials from other projects:

1. **Keep only what you need:**
   - LLM API keys ✅
   - AWS (only if using S3) ⚠️
   - Database URL (when ready) ⚠️

2. **Remove:**
   - GitHub credentials (not needed for UBL)
   - LAB512 config (not needed for UBL)
   - Atomic Agents config (not needed for UBL)
   - Bedrock token (not needed for UBL)

3. **Organize:**
   - Group by category
   - Add comments
   - Use `.env.example` as template

## Example .env Structure

```bash
# Server
PORT=3000
HOST=0.0.0.0

# LLM
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY...
GEMINI_API_KEY=...

# Database (when ready)
# DATABASE_URL=postgresql://...

# AWS (only if using S3)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_S3_BUCKET=...
```

Clean and organized! 🎯

