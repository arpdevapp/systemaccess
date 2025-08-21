// WebRTC Configuration for STUN/TURN servers
// These servers help establish peer-to-peer connections across different networks

export const WEBRTC_CONFIG = {
  // STUN servers (free, public servers for basic NAT traversal)
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    },
    // TURN servers (for more complex NAT traversal - you'll need to set up your own)
    // Uncomment and configure these if you have TURN servers
    /*
    {
      urls: [
        'turn:your-turn-server.com:3478',
        'turns:your-turn-server.com:5349'
      ],
      username: 'your-username',
      credential: 'your-password'
    }
    */
  ],
  
  // ICE candidate gathering configuration
  iceCandidatePoolSize: 10,
  
  // Connection timeout settings
  connectionTimeout: 30000, // 30 seconds
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  
  // Bandwidth constraints (optional)
  bandwidthConstraints: {
    audio: {
      maxBitrate: 128000, // 128 kbps
      maxFramerate: 30
    },
    video: {
      maxBitrate: 2500000, // 2.5 Mbps
      maxFramerate: 30,
      maxWidth: 1920,
      maxHeight: 1080
    }
  }
};

// Alternative STUN servers (backup options)
export const BACKUP_STUN_SERVERS = [
  'stun:stun.voiparound.com:3478',
  'stun:stun.voipbuster.com:3478',
  'stun:stun.voipstunt.com:3478',
  'stun:stun.voxgratia.org:3478',
  'stun:stun.xten.com:3478'
];

// TURN server setup instructions
export const TURN_SETUP_INSTRUCTIONS = `
To set up your own TURN server for better connectivity:

1. Install coturn (TURN server):
   - Ubuntu/Debian: sudo apt-get install coturn
   - macOS: brew install coturn
   - Windows: Download from https://github.com/coturn/coturn

2. Configure coturn in /etc/turnserver.conf:
   listening-port=3478
   tls-listening-port=5349
   listening-ip=YOUR_SERVER_IP
   external-ip=YOUR_PUBLIC_IP
   realm=your-domain.com
   server-name=your-domain.com
   user-quota=12
   total-quota=1200
   authentication-method=long-term
   user=username:password

3. Start the server:
   sudo systemctl start coturn

4. Update the WEBRTC_CONFIG.iceServers array with your TURN server details
`;

// Connection quality monitoring
export const CONNECTION_MONITORING = {
  // Ping interval for connection health checks
  pingInterval: 5000, // 5 seconds
  
  // Quality thresholds
  qualityThresholds: {
    excellent: { latency: 50, packetLoss: 0.01 },    // < 50ms, < 1%
    good: { latency: 100, packetLoss: 0.05 },       // < 100ms, < 5%
    fair: { latency: 200, packetLoss: 0.10 },       // < 200ms, < 10%
    poor: { latency: 500, packetLoss: 0.20 }        // > 500ms, > 20%
  }
};

export default WEBRTC_CONFIG;
