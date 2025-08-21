# 🔗 SystemAccess - Remote Access System

A secure, peer-to-peer remote access system built with WebRTC that allows you to connect to and control remote systems over the internet, even across different networks.

## ✨ Features

- **🖥️ Screen Sharing**: Share your screen with remote users
- **🎮 Remote Control**: Control remote systems with mouse and keyboard
- **🔒 Secure Connection**: Direct peer-to-peer WebRTC connections
- **🌐 Cross-Network**: Works across different Wi-Fi networks and NATs
- **📱 Responsive Design**: Works on desktop and mobile devices
- **📁 File Transfer**: Send and receive files (coming soon)
- **⚡ Low Latency**: Direct connections for optimal performance

## 🏗️ Architecture

The system consists of three main components:

1. **Signaling Server** - Node.js server that facilitates WebRTC connection establishment
2. **Host Client** - React app for sharing screen and accepting connections
3. **Remote Client** - React app for connecting to and controlling remote systems

```
Internet
    │
    ├── Signaling Server (Port 3001)
    │   ├── WebSocket connections
    │   └── Connection coordination
    │
    ├── Host System (Port 5173)
    │   ├── Screen sharing
    │   └── WebRTC peer
    │
    └── Remote Client (Port 5173)
        ├── Remote control interface
        └── WebRTC peer
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser with WebRTC support

### 1. Install Dependencies

```bash
# Install main app dependencies
npm install

# Install signaling server dependencies
cd server
npm install
cd ..
```

### 2. Start the Signaling Server

```bash
# Start the signaling server
npm run server

# Or manually:
cd server
npm start
```

The signaling server will start on port 3001.

### 3. Start the React App

```bash
# In a new terminal, start the React app
npm run dev
```

The React app will start on port 5173.

### 4. Access the Application

Open your browser and navigate to:
- **Main App**: http://localhost:5173
- **Signaling Server Health**: http://localhost:3001/health

## 📖 Usage Guide

### Host Mode (Screen Sharing)

1. **Select Host Mode**: Choose "Host Mode" from the main menu
2. **Get Connection Code**: A 6-character connection code will be generated
3. **Share Code**: Send this code to the person who wants to connect
4. **Start Screen Share**: Click "Start Screen Share" to begin sharing
5. **Wait for Connection**: The remote user will connect using your code

### Client Mode (Remote Control)

1. **Select Client Mode**: Choose "Client Mode" from the main menu
2. **Enter Connection Code**: Input the 6-character code from the host
3. **Connect**: Click "Connect" to establish the connection
4. **Control**: Once connected, you can see and control the remote system

## 🔧 Configuration

### WebRTC Settings

Edit `src/config/webrtc-config.js` to customize:

- STUN/TURN servers
- Connection timeouts
- Bandwidth constraints
- ICE candidate settings

### Signaling Server

Edit `server/signaling-server.js` to modify:

- Port number
- CORS settings
- Room management
- Event handling

## 🌐 Network Configuration

### For Production Use

1. **Deploy Signaling Server**: Host the signaling server on a public server
2. **Update Client URLs**: Change `localhost:3001` to your server's public IP/domain
3. **Configure TURN Server**: Set up a TURN server for better NAT traversal
4. **SSL/TLS**: Use HTTPS/WSS for secure connections

### TURN Server Setup

For better connectivity across restrictive networks:

```bash
# Install coturn
sudo apt-get install coturn

# Configure /etc/turnserver.conf
listening-port=3478
tls-listening-port=5349
listening-ip=YOUR_SERVER_IP
external-ip=YOUR_PUBLIC_IP
realm=your-domain.com
user=username:password

# Start service
sudo systemctl start coturn
```

## 🔒 Security Considerations

- **WebRTC**: All data is encrypted end-to-end
- **Signaling**: Only connection metadata passes through the server
- **Authentication**: Consider adding user authentication for production
- **Network**: Use HTTPS/WSS in production environments
- **Firewall**: Ensure ports 3001 (signaling) and WebRTC ports are accessible

## 🐛 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check if signaling server is running
   - Verify firewall settings
   - Check browser console for errors

2. **Screen Share Not Working**
   - Ensure browser permissions are granted
   - Check if screen sharing is supported
   - Try refreshing the page

3. **High Latency**
   - Check network quality
   - Consider setting up a TURN server
   - Reduce video quality settings

4. **Cross-Network Issues**
   - Verify STUN/TURN server configuration
   - Check router NAT settings
   - Ensure ports are forwarded correctly

### Debug Mode

Enable detailed logging in the browser console:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

## 📱 Browser Support

- **Chrome**: 72+ (Full support)
- **Firefox**: 66+ (Full support)
- **Safari**: 12.1+ (Full support)
- **Edge**: 79+ (Full support)

## 🚧 Development

### Project Structure

```
systemaccess/
├── src/
│   ├── components/
│   │   ├── RemoteAccessHost.jsx
│   │   └── RemoteAccessClient.jsx
│   ├── config/
│   │   └── webrtc-config.js
│   ├── App.jsx
│   └── App.css
├── server/
│   ├── signaling-server.js
│   └── package.json
├── package.json
└── README.md
```

### Adding Features

1. **File Transfer**: Implement WebRTC data channels
2. **Audio Support**: Add microphone sharing
3. **Multi-User**: Support multiple remote clients
4. **Recording**: Add session recording capability

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review browser console for errors
3. Verify network configuration
4. Open an issue on GitHub

---

**Note**: This system is designed for legitimate remote access use cases. Users are responsible for ensuring they have proper authorization before accessing remote systems.
