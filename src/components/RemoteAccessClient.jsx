import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const RemoteAccessClient = () => {
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [connectionCode, setConnectionCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [remoteHost, setRemoteHost] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('disconnected');

  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    // Initialize canvas context
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, []);

  const connectToHost = async () => {
    if (!connectionCode.trim()) {
      setError('Please enter a connection code');
      return;
    }

    try {
      setIsConnecting(true);
      setError('');
      setStatus('connecting');

      // Connect to signaling server
      const newSocket = io('http://localhost:3001');
      setSocket(newSocket);

      // Register as client
      newSocket.emit('register', {
        clientId: `client-${Date.now()}`,
        clientType: 'client',
        roomId: connectionCode.trim().toUpperCase()
      });

      // Listen for host joining
      newSocket.on('clientJoined', (data) => {
        if (data.clientType === 'host') {
          setRemoteHost(data);
          setStatus('host-found');
        }
      });

      // Listen for host leaving
      newSocket.on('clientLeft', (data) => {
        if (data.clientType === 'host') {
          setRemoteHost(null);
          setIsConnected(false);
          setStatus('host-disconnected');
          if (peer) {
            peer.destroy();
            setPeer(null);
          }
        }
      });

      // Listen for WebRTC answers
      newSocket.on('answer', async (data) => {
        try {
          setStatus('establishing-connection');
          
          // Create peer connection
          const newPeer = new Peer({
            initiator: true,
            trickle: false
          });

          newPeer.on('signal', (signal) => {
            // Send offer to host
            newSocket.emit('offer', {
              targetId: data.from,
              offer: signal,
              roomId: connectionCode.trim().toUpperCase()
            });
          });

          newPeer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            setIsConnected(true);
            setStatus('connected');
          });

          newPeer.on('connect', () => {
            setIsConnected(true);
            setStatus('connected');
            setError('');
          });

          newPeer.on('error', (err) => {
            setError(`WebRTC Error: ${err.message}`);
            setStatus('error');
          });

          // Set the answer
          newPeer.signal(data.answer);
          setPeer(newPeer);

        } catch (err) {
          setError(`Failed to establish connection: ${err.message}`);
          setStatus('error');
        }
      });

      // Listen for ICE candidates
      newSocket.on('iceCandidate', (data) => {
        if (peer) {
          peer.signal(data.candidate);
        }
      });

      setIsConnecting(false);

    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      setStatus('error');
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    if (peer) {
      peer.destroy();
      setPeer(null);
    }
    setRemoteHost(null);
    setIsConnected(false);
    setStatus('disconnected');
    setError('');
  };

  // Handle mouse events for remote control
  const handleCanvasClick = (e) => {
    if (!isConnected || !ctxRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Send mouse click event to host (this would be implemented with a data channel)
    console.log(`Mouse click at: ${x}, ${y}`);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isConnected || !ctxRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Send mouse move event to host (this would be implemented with a data channel)
    console.log(`Mouse move to: ${x}, ${y}`);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'host-found': return '#2196F3';
      case 'establishing-connection': return '#FF9800';
      case 'connecting': return '#FF9800';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'disconnected': return 'Enter connection code to connect';
      case 'connecting': return 'Connecting to signaling server...';
      case 'host-found': return 'Host found, establishing connection...';
      case 'establishing-connection': return 'Establishing secure connection...';
      case 'connected': return 'Connected! You can now control the remote system';
      case 'host-disconnected': return 'Host disconnected';
      case 'error': return 'Connection error occurred';
      default: return status;
    }
  };

  return (
    <div className="remote-access-client">
      <div className="client-header">
        <h2>🎮 Client Mode - Remote Control</h2>
        <div className="status-indicator" style={{ backgroundColor: getStatusColor() }}>
          {getStatusText()}
        </div>
      </div>

      {!isConnected && (
        <div className="connection-form">
          <h3>Connect to Remote System</h3>
          <div className="input-group">
            <label htmlFor="connectionCode">Connection Code:</label>
            <input
              type="text"
              id="connectionCode"
              value={connectionCode}
              onChange={(e) => setConnectionCode(e.target.value)}
              placeholder="Enter the 6-character code"
              maxLength={6}
              disabled={isConnecting}
            />
          </div>
          
          <div className="connection-buttons">
            {!isConnecting ? (
              <button 
                className="control-btn primary"
                onClick={connectToHost}
                disabled={!connectionCode.trim()}
              >
                🔗 Connect
              </button>
            ) : (
              <button className="control-btn" disabled>
                🔄 Connecting...
              </button>
            )}
          </div>
        </div>
      )}

      {isConnected && (
        <div className="remote-control-interface">
          <div className="remote-video-container">
            <h3>Remote System Screen</h3>
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline
              className="remote-video"
            />
            
            {/* Canvas overlay for mouse control */}
            <canvas
              ref={canvasRef}
              className="control-canvas"
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: 'crosshair'
              }}
            />
          </div>

          <div className="control-panel">
            <h3>Remote Control</h3>
            <div className="control-buttons">
              <button className="control-btn">
                ⌨️ Send Ctrl+Alt+Del
              </button>
              <button className="control-btn">
                📁 File Transfer
              </button>
              <button className="control-btn">
                📸 Screenshot
              </button>
              <button className="control-btn danger" onClick={disconnect}>
                ❌ Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {remoteHost && (
        <div className="host-info">
          <h3>Connected Host</h3>
          <p><strong>ID:</strong> {remoteHost.clientId}</p>
          <p><strong>Status:</strong> {isConnected ? 'Active' : 'Connecting...'}</p>
        </div>
      )}

      <div className="info-box">
        <h3>Remote Control Features:</h3>
        <ul>
          <li><strong>Screen Viewing:</strong> See the remote system's screen in real-time</li>
          <li><strong>Mouse Control:</strong> Click and move mouse on the remote system</li>
          <li><strong>Keyboard Input:</strong> Send keyboard commands to remote system</li>
          <li><strong>File Transfer:</strong> Send and receive files (coming soon)</li>
        </ul>
      </div>
    </div>
  );
};

export default RemoteAccessClient;
