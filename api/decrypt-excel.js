import officeCrypto from 'officecrypto-tool';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileBase64, password } = req.body;

    if (!fileBase64) {
      return res.status(400).json({ error: 'Missing file data' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const inputBuffer = Buffer.from(fileBase64, 'base64');

    const isEnc = officeCrypto.isEncrypted(inputBuffer);
    if (!isEnc) {
      return res.status(200).json({ decryptedBase64: fileBase64, wasEncrypted: false });
    }

    try {
      const decryptedBuffer = await officeCrypto.decrypt(inputBuffer, { password });
      return res.status(200).json({ 
        decryptedBase64: Buffer.from(decryptedBuffer).toString('base64'),
        wasEncrypted: true 
      });
    } catch (decryptErr) {
      const errMsg = decryptErr.message || '';
      if (
        errMsg.toLowerCase().includes('password is incorrect') ||
        errMsg.toLowerCase().includes('password') ||
        errMsg.toLowerCase().includes('verifier') ||
        errMsg.toLowerCase().includes('integrity')
      ) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }
      return res.status(400).json({ error: 'Failed to decrypt file: ' + errMsg });
    }
  } catch (err) {
    console.error('Decrypt excel error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error while decrypting file' });
  }
}
