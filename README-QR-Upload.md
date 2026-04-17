# QR Upload Feature Documentation

## Overview

This feature enables users to upload documents from their phone to the desktop application using a QR code-based flow, eliminating the friction of transferring files between devices.

## Architecture

### Core Components

1. **QRUploadManager** (`src/utils/qrUpload.ts`)
   - Manages upload sessions with 10-minute expiration
   - Generates QR codes containing unique session URLs
   - Handles file validation (PDF, JPG, PNG, max 5MB)
   - Provides real-time sync via polling (WebSocket ready)

2. **Enhanced UploadModal** (`src/components/UploadModal.tsx`)
   - Multiple states: initial, QR display, waiting, success, error, expired
   - Seamless integration with existing drag-and-drop functionality
   - Real-time updates when upload completes

3. **MobileUploadPage** (`src/components/MobileUploadPage.tsx`)
   - Mobile-optimized interface for phone uploads
   - Native file picker with camera support
   - Progress tracking and error handling

4. **Mock API Layer** (`src/utils/mockApi.ts`)
   - Simulates backend endpoints for development
   - Ready for production API integration

## User Flow

### Desktop Flow
1. User opens Upload Signed Document modal
2. Clicks "Upload from Phone" button
3. Modal shows QR code with instructions
4. Desktop enters "Waiting for upload..." state
5. File appears automatically when upload completes
6. User can proceed with submission

### Mobile Flow
1. User scans QR code with phone camera
2. Opens mobile upload page (no login required)
3. Clicks "Upload File" to open native picker
4. Selects file (camera, gallery, or files)
5. File uploads with progress indicator
6. Success screen confirms upload

## Technical Implementation

### Session Management
```typescript
interface UploadSession {
  session_id: string;
  expires_at: number;
  status: 'waiting' | 'uploaded' | 'expired';
  file_url?: string;
  file_name?: string;
  file_type?: string;
  size?: number;
}
```

### QR Code Generation
- Uses `qrcode` library to generate Data URLs
- Encodes mobile upload URL with session ID
- 256x256px with standard QR code settings

### Real-time Sync
- Currently uses polling every 2 seconds
- WebSocket infrastructure ready for production
- Automatic cleanup when upload completes or expires

### File Validation
- Allowed types: `image/jpeg`, `image/png`, `application/pdf`
- Maximum size: 5MB
- Server-side validation in upload handler

## Security Features

1. **Session Expiration**: 10-minute auto-expiration
2. **One-time Upload**: Each session accepts only one file
3. **File Type Validation**: Strict whitelist of allowed types
4. **Size Limits**: 5MB maximum file size
5. **Session Invalidation**: Automatic cleanup on modal close

## API Endpoints (Mock Implementation)

### Create Session
```
POST /api/upload-session
Response: { session_id: string, expires_at: number }
```

### Upload File
```
POST /api/upload/{sessionId}
Content-Type: multipart/form-data
Response: { success: boolean, file_url: string }
```

### Get Status
```
GET /api/upload-status/{sessionId}
Response: UploadSession | null
```

### WebSocket (Future)
```
WS /ws/upload/{sessionId}
Messages: { type: 'status_update', session: UploadSession }
```

## Integration Guide

### Adding to Existing Components

The QR upload feature is already integrated into the existing `UploadModal`. To use it:

```tsx
import { UploadModal } from "@/components/UploadModal";

function YourComponent() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  
  return (
    <UploadModal
      open={uploadModalOpen}
      onClose={() => setUploadModalOpen(false)}
      onFileSelected={(file) => {
        // Handle uploaded file
        console.log('File uploaded:', file);
      }}
    />
  );
}
```

### Custom Mobile Page

To customize the mobile upload experience:

```tsx
import { MobileUploadPage } from "@/components/MobileUploadPage";

function CustomMobileUpload() {
  const { sessionId } = useParams();
  return <MobileUploadPage sessionId={sessionId} />;
}
```

## Production Deployment

### Environment Variables
```env
VITE_API_BASE_URL=https://your-api.com
VITE_WS_URL=wss://your-api.com
```

### Backend Requirements
1. Session storage (Redis recommended)
2. File storage (S3 or similar)
3. WebSocket server for real-time updates
4. File validation and virus scanning

### SSL Requirements
- HTTPS required for camera access on mobile
- WSS required for WebSocket connections
- Valid SSL certificate for production

## Testing

### Manual Testing
1. Open desktop application
2. Click "Upload from Phone"
3. Scan QR code with mobile device
4. Upload test file (PDF or image)
5. Verify file appears in desktop modal

### Automated Testing
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test mobile upload flow
# Open http://localhost:3000/mobile-upload/test-session-id
```

## Troubleshooting

### Common Issues

1. **QR Code Not Working**
   - Check session ID is valid
   - Verify mobile URL is accessible
   - Ensure HTTPS in production

2. **Upload Fails**
   - Check file type and size
   - Verify session hasn't expired
   - Check network connectivity

3. **Real-time Updates Not Working**
   - Verify polling is active
   - Check session status updates
   - Implement WebSocket for production

## Browser Compatibility

### Desktop
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Mobile
- iOS Safari 13+
- Chrome Mobile 80+
- Samsung Internet 12+

## Performance Considerations

1. **QR Code Generation**: Cached for session duration
2. **File Upload**: Chunked upload for large files
3. **Polling**: Exponential backoff for failed requests
4. **Memory**: Automatic cleanup of expired sessions

## Future Enhancements

1. **Multiple File Upload**: Support for batch uploads
2. **File Preview**: Image thumbnails in mobile view
3. **Cloud Integration**: Direct upload from cloud storage
4. **Analytics**: Upload success metrics and timing
5. **Offline Support**: PWA capabilities for mobile

## Support

For issues or questions about the QR upload feature:
1. Check the troubleshooting section above
2. Review browser console for errors
3. Verify API endpoints are accessible
4. Test with different file types and sizes
