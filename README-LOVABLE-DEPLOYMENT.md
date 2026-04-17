# Lovable Deployment Guide

## Overview

This guide explains how to deploy the QR upload feature to Lovable with real backend API support for cross-device functionality.

## What's Included

### Frontend Components
- **UploadModal**: Enhanced with QR upload flow
- **MobileUploadPage**: Mobile-optimized upload interface
- **API Client**: Real HTTP client for backend communication

### Backend API
- **Hono Server**: Lightweight web framework
- **Session Management**: In-memory storage (upgradeable to Redis)
- **File Upload**: Multipart form handling
- **CORS Support**: Cross-origin requests enabled

## Deployment Steps

### 1. Push to Lovable

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Add real backend API for QR upload feature"

# Push to GitHub
git push origin main
```

### 2. Configure Lovable

1. Go to your Lovable dashboard
2. Import/update the repository
3. Set environment variables:
   ```
   VITE_API_BASE_URL=https://your-app.lovable.app
   ```

### 3. Deploy Settings

In `lovable.json`:
- **Type**: Full-stack application
- **Framework**: Vite + Hono
- **Build**: `npm run build`
- **Start**: `npm run start`

## API Endpoints

### Upload Sessions
- `POST /api/upload-sessions` - Create new session
- `GET /api/upload-sessions/:sessionId` - Get session status
- `DELETE /api/upload-sessions/:sessionId` - Delete session

### File Upload
- `POST /api/upload/:sessionId` - Upload file (multipart)

### Health Check
- `GET /api/health` - Server health status

## Environment Variables

### Required
```env
VITE_API_BASE_URL=https://your-app.lovable.app
```

### Optional (for file storage)
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your-bucket
AWS_REGION=us-east-1
```

## Testing the Deployment

### 1. Desktop Flow
1. Open your Lovable app
2. Click "Upload from Phone"
3. Scan QR code with mobile device

### 2. Mobile Flow
1. Open QR code link on phone
2. Upload file using mobile interface
3. Verify file appears on desktop

### 3. API Testing
```bash
# Health check
curl https://your-app.lovable.app/api/health

# Create session
curl -X POST https://your-app.lovable.app/api/upload-sessions
```

## Production Considerations

### Session Storage
- **Current**: In-memory (resets on server restart)
- **Recommended**: Redis or database for persistence
- **Upgrade**: Replace `sessions` Map with Redis client

### File Storage
- **Current**: Temporary URLs (memory)
- **Recommended**: AWS S3 or similar
- **Upgrade**: Implement S3 upload in `uploadFile` handler

### Security
- **CORS**: Enabled for all origins (restrict in production)
- **File Validation**: Type and size checking implemented
- **Session Expiration**: 10-minute TTL

## Monitoring

### Health Endpoint
```json
{
  "status": "ok",
  "active_sessions": 5,
  "timestamp": 1640995200000
}
```

### Logs
Hono logger enabled for all API requests

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check API base URL configuration
   - Verify Lovable domain in CORS settings

2. **Session Not Found**
   - Sessions reset on server restart
   - Check session expiration (10 minutes)

3. **Upload Fails**
   - Verify file type (PDF, JPG, PNG)
   - Check file size (max 5MB)

4. **QR Code Not Working**
   - Ensure mobile URL is accessible
   - Check session ID in QR code

## Performance

### Current Limits
- Concurrent sessions: Memory-based
- File storage: Temporary
- Session duration: 10 minutes

### Scaling
- Add Redis for session persistence
- Implement S3 for file storage
- Add rate limiting for abuse prevention

## Next Steps

1. **Deploy to Lovable** using this guide
2. **Test cross-device upload** functionality
3. **Monitor performance** and usage
4. **Upgrade storage** for production use

## Support

For issues with Lovable deployment:
1. Check Lovable documentation
2. Review server logs in dashboard
3. Verify environment variables
4. Test API endpoints directly
