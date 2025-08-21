import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

function App() {
  const [mode, setMode] = useState('select');
  const [connectionCode, setConnectionCode] = useState('');
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteClient, setRemoteClient] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('disconnected');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Generate a random room ID
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Safe clipboard copy function with fallback
  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Modern clipboard API (requires HTTPS or localhost)
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers or HTTP
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
      return false;
    }
  };

  useEffect(() => {
    if (mode === 'host') {
      const roomId = generateRoomId();
      setConnectionCode(roomId);
      
      // Connect to signaling server
      const newSocket = io('http://192.168.1.5:3001');
      setSocket(newSocket);

      // Register as host
      newSocket.emit('register', {
        clientId: `host-${roomId}`,
        clientType: 'host',
        roomId: roomId
      });

      // Listen for client joining
      newSocket.on('clientJoined', (data) => {
        if (data.clientType === 'client') {
          setRemoteClient(data);
          setStatus('client-connected');
          setError('');
        }
      });

      // Listen for client leaving
      newSocket.on('clientLeft', (data) => {
        setRemoteClient(null);
        setIsConnected(false);
        setStatus('client-disconnected');
        if (peer) {
          peer.destroy();
          setPeer(null);
        }
      });

      // Listen for WebRTC offers
      newSocket.on('offer', async (data) => {
        try {
          setStatus('establishing-connection');
          
          // Create peer connection
          const newPeer = new Peer({
            initiator: false,
            trickle: false,
            stream: localStreamRef.current
          });

          newPeer.on('signal', (signal) => {
            // Send answer back to client
            newSocket.emit('answer', {
              targetId: data.from,
              answer: signal,
              roomId: roomId
            });
          });

          newPeer.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
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

          // Set the offer
          newPeer.signal(data.offer);
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

      return () => {
        newSocket.disconnect();
        if (peer) {
          peer.destroy();
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
      };
    }
  }, [mode]);

  const startScreenShare = async () => {
    try {
      setStatus('starting-screen-share');
      
      // Check if getDisplayMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.');
      }

      // Check if we're in a secure context (HTTPS or localhost)
      if (!window.isSecureContext) {
        throw new Error('Screen sharing requires a secure connection (HTTPS) or localhost. Please access via localhost instead of IP address.');
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsScreenSharing(true);
      setStatus('screen-sharing');
      setError('');

      // If we have a peer, update their stream
      if (peer) {
        peer.replaceTrack(
          peer.streams[0].getVideoTracks()[0],
          stream.getVideoTracks()[0],
          peer.streams[0]
        );
      }

      // Handle stream ending
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        setStatus('screen-share-ended');
      };

    } catch (err) {
      console.error('Screen sharing error:', err);
      setError(`Failed to start screen sharing: ${err.message}`);
      setStatus('error');
    }
  };

  const stopScreenShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setStatus('screen-share-stopped');
  };

  const connectToHost = async () => {
    if (!connectionCode.trim()) {
      setError('Please enter a connection code');
      return;
    }

    try {
      setStatus('connecting');
      setError('');

      // Connect to signaling server
      const newSocket = io('http://192.168.1.5:3001');
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
          setRemoteClient(data);
          setStatus('host-found');
        }
      });

      // Listen for host leaving
      newSocket.on('clientLeft', (data) => {
        if (data.clientType === 'host') {
          setRemoteClient(null);
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

    } catch (err) {
      setError(`Failed to connect: ${err.message}`);
      setStatus('error');
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
    setRemoteClient(null);
    setIsConnected(false);
    setStatus('disconnected');
    setError('');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'client-connected': return '#2196F3';
      case 'establishing-connection': return '#FF9800';
      case 'connecting': return '#FF9800';
      case 'host-found': return '#2196F3';
      case 'screen-sharing': return '#4CAF50';
      case 'error': return '#F44336';
      default: return '#757575';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'disconnected': return 'Ready to connect';
      case 'connecting': return 'Connecting to signaling server...';
      case 'host-found': return 'Host found, establishing connection...';
      case 'establishing-connection': return 'Establishing secure connection...';
      case 'connected': return 'Connected! You can now control the remote system';
      case 'client-connected': return 'Client connected, waiting for WebRTC...';
      case 'screen-sharing': return 'Screen sharing active';
      case 'error': return 'Connection error occurred';
      default: return status;
    }
  };

  const renderModeSelection = () => (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      textAlign: 'center', 
      padding: '40px',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '20px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
    }}>
      <h1 style={{ 
        fontSize: '2.5rem', 
        marginBottom: '20px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        🔗 SystemAccess Remote Control
      </h1>
      <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '40px' }}>
        Choose your role to establish a remote connection
      </p>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px', 
        marginBottom: '40px' 
      }}>
        <button 
          style={{ 
            background: 'white',
            border: '2px solid #e0e0e0',
            borderRadius: '15px',
            padding: '30px 20px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}
          onClick={() => setMode('host')}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-5px)';
            e.target.style.borderColor = '#4CAF50';
            e.target.style.background = '#f1f8e9';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.borderColor = '#e0e0e0';
            e.target.style.background = 'white';
          }}
        >
          <span style={{ fontSize: '2rem' }}>🖥️</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Host Mode</span>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            Share your screen and allow remote control
          </span>
        </button>
        
        <button 
          style={{ 
            background: 'white',
            border: '2px solid #e0e0e0',
            borderRadius: '15px',
            padding: '30px 20px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '15px'
          }}
          onClick={() => setMode('client')}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-5px)';
            e.target.style.borderColor = '#2196F3';
            e.target.style.background = '#e3f2fd';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.borderColor = '#e0e0e0';
            e.target.style.background = 'white';
          }}
        >
          <span style={{ fontSize: '2rem' }}>🎮</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Client Mode</span>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            Connect to and control a remote system
          </span>
        </button>
      </div>
      
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '10px', 
        padding: '25px', 
        textAlign: 'left',
        borderLeft: '4px solid #667eea'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>How it works:</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
            <strong style={{ color: '#667eea' }}>Host:</strong> Generates a connection code and shares their screen
          </li>
          <li style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
            <strong style={{ color: '#667eea' }}>Client:</strong> Enters the connection code to establish control
          </li>
          <li style={{ padding: '8px 0', borderBottom: '1px solid #e0e0e0' }}>
            <strong style={{ color: '#667eea' }}>WebRTC:</strong> Direct peer-to-peer connection for low latency
          </li>
          <li style={{ padding: '8px 0' }}>
            <strong style={{ color: '#667eea' }}>Secure:</strong> No data passes through our servers after connection
          </li>
        </ul>
      </div>
    </div>
  );

  const renderBackButton = () => (
    <button 
      style={{ 
        background: '#6c757d', 
        color: 'white', 
        border: 'none', 
        padding: '10px 20px', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        marginBottom: '20px',
        fontSize: '1rem'
      }}
      onClick={() => setMode('select')}
    >
      ← Back to Mode Selection
    </button>
  );

  const renderHostMode = () => (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      background: 'rgba(255, 255, 255, 0.95)', 
      borderRadius: '20px', 
      padding: '30px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
    }}>
      {renderBackButton()}
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '15px', color: '#333' }}>
          🖥️ Host Mode - Screen Sharing
        </h2>
        <div style={{ 
          display: 'inline-block', 
          padding: '10px 20px', 
          borderRadius: '25px', 
          color: 'white', 
          fontWeight: '600', 
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          backgroundColor: getStatusColor()
        }}>
          {getStatusText()}
        </div>
      </div>

      <div style={{ 
        textAlign: 'center', 
        marginBottom: '30px', 
        padding: '20px', 
        background: '#f8f9fa', 
        borderRadius: '15px' 
      }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>Connection Code</h3>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '15px', 
          marginBottom: '15px' 
        }}>
          <span style={{ 
            fontFamily: 'Courier New, monospace', 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            background: '#333', 
            color: 'white', 
            padding: '15px 25px', 
            borderRadius: '10px', 
            letterSpacing: '3px' 
          }}>
            {connectionCode}
          </span>
          <button 
            style={{ 
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              padding: '10px 15px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontSize: '1rem'
            }}
            onClick={async () => {
              const success = await copyToClipboard(connectionCode);
              if (success) {
                // Show success feedback
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '✅ Copied!';
                button.style.background = '#28a745';
                setTimeout(() => {
                  button.textContent = originalText;
                }, 2000);
              } else {
                // Show error feedback
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = '❌ Failed';
                button.style.background = '#dc3545';
                setTimeout(() => {
                  button.textContent = originalText;
                  button.style.background = '#28a745';
                }, 2000);
              }
            }}
          >
            📋 Copy
          </button>
        </div>
        <p style={{ color: '#666' }}>
          Share this code with the person who wants to connect to your system
        </p>
      </div>

      <div style={{ textAlign: 'center' }}>
        {!isScreenSharing ? (
          <div>
            <button 
              style={{ 
                padding: '15px 30px', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '1.2rem', 
                fontWeight: '600',
                backgroundColor: '#007bff',
                color: 'white',
                marginBottom: '15px'
              }}
              onClick={startScreenShare}
            >
              🖥️ Start Screen Share
            </button>
            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffeaa7', 
              borderRadius: '8px', 
              padding: '10px', 
              fontSize: '0.9rem',
              color: '#856404',
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <strong>💡 Tip:</strong> For screen sharing to work, access this page via <strong>localhost:5173</strong> instead of the IP address.
            </div>
          </div>
        ) : (
          <button 
            style={{ 
              padding: '15px 30px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '1.2rem', 
              fontWeight: '600',
              backgroundColor: '#dc3545',
              color: 'white'
            }}
            onClick={stopScreenShare}
          >
            ⏹️ Stop Screen Share
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {remoteClient && (
        <div style={{
          background: '#e3f2fd',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          borderLeft: '4px solid #2196F3'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#1976d2' }}>Connected Client</h3>
          <p style={{ marginBottom: '8px' }}><strong>ID:</strong> {remoteClient.clientId}</p>
          <p style={{ marginBottom: '8px' }}><strong>Status:</strong> {isConnected ? 'Active' : 'Connecting...'}</p>
        </div>
      )}
    </div>
  );

  const renderClientMode = () => (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      background: 'rgba(255, 255, 255, 0.95)', 
      borderRadius: '20px', 
      padding: '30px',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
    }}>
      {renderBackButton()}
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '15px', color: '#333' }}>
          🎮 Client Mode - Remote Control
        </h2>
        <div style={{ 
          display: 'inline-block', 
          padding: '10px 20px', 
          borderRadius: '25px', 
          color: 'white', 
          fontWeight: '600', 
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          backgroundColor: getStatusColor()
        }}>
          {getStatusText()}
        </div>
      </div>

      <div style={{ 
        maxWidth: '500px', 
        margin: '0 auto 30px', 
        padding: '25px', 
        background: '#f8f9fa', 
        borderRadius: '15px', 
        textAlign: 'center' 
      }}>
        <h3 style={{ marginBottom: '20px', color: '#333' }}>Connect to Remote System</h3>
        <div style={{ marginBottom: '20px', textAlign: 'left' }}>
          <label 
            htmlFor="connectionCode" 
            style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600', 
              color: '#333' 
            }}
          >
            Connection Code:
          </label>
          <input
            type="text"
            id="connectionCode"
            value={connectionCode}
            onChange={(e) => setConnectionCode(e.target.value)}
            placeholder="Enter the 6-character code"
            maxLength={6}
            style={{
              width: '100%',
              padding: '12px 15px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '1rem',
              transition: 'border-color 0.3s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#007bff'}
            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
          />
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <button 
            style={{ 
              padding: '12px 25px', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '1rem', 
              fontWeight: '600',
              backgroundColor: '#007bff',
              color: 'white',
              width: '100%'
            }}
            onClick={connectToHost}
            disabled={!connectionCode.trim()}
          >
            🔗 Connect
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#f8d7da',
          color: '#721c24',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {remoteClient && (
        <div style={{
          background: '#e8f5e8',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          borderLeft: '4px solid #4CAF50'
        }}>
          <h3 style={{ marginBottom: '15px', color: '#2e7d32' }}>Connected Host</h3>
          <p style={{ marginBottom: '8px' }}><strong>ID:</strong> {remoteClient.clientId}</p>
          <p style={{ marginBottom: '8px' }}><strong>Status:</strong> {isConnected ? 'Active' : 'Connecting...'}</p>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {mode === 'select' && renderModeSelection()}
      {mode === 'host' && renderHostMode()}
      {mode === 'client' && renderClientMode()}
    </div>
  );
}

export default App;
