import QRCode from 'qrcode';
const url = process.argv[2] || 'http://localhost:8081/mobile-upload/session_test';
(async () => {
  try {
    const data = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    console.log(data);
  } catch (err) {
    console.error('QR generation failed:', err);
    process.exit(1);
  }
})();
