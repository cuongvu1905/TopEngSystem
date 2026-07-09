// Stream Chat Realtime client adapter for Next.js (SSR compatible via Dynamic Imports)

export const StreamChatAdapter = {
  client: null,
  activeChannel: null,

  isEnabled: function() {
    return typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_STREAM_API_KEY;
  },

  init: async function(userId, userName) {
    if (!this.isEnabled()) return null;
    if (this.client) return this.client;

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    try {
      const { StreamChat } = await import('stream-chat');
      this.client = StreamChat.getInstance(apiKey);
      let token;
      try {
        const response = await fetch('/api/stream-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
        if (response.ok) {
          const data = await response.json();
          token = data.token;
        }
      } catch (err) {
        console.warn("Could not fetch Stream token from backend, falling back to developer token:", err);
      }

      if (!token) {
        // Fallback to development token
        token = this.client.devToken(userId);
      }

      await this.client.connectUser({ id: userId, name: userName }, token);
      console.log("Stream Chat client connected successfully. Token source:", token.includes('.') ? "Backend API" : "DevToken");
      return this.client;
    } catch (e) {
      console.error("Failed to connect Stream Chat client: ", e);
      return null;
    }
  },

  joinChannel: async function(roomId, roomName, type = 'messaging') {
    if (!this.client) return null;
    try {
      // Normalize room ID because Stream Chat IDs can only contain lowercase alphanumeric, '_' and '-'
      const cleanRoomId = roomId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const channel = this.client.channel(type, cleanRoomId, {
        name: roomName
      });
      await channel.watch();
      this.activeChannel = channel;
      return channel;
    } catch (e) {
      console.error(`Failed to join Stream channel ${roomId}: `, e);
      return null;
    }
  },

  sendMessage: async function(text) {
    if (!this.activeChannel) return null;
    return this.activeChannel.sendMessage({ text });
  },

  disconnect: async function() {
    if (this.client) {
      try {
        await this.client.disconnectUser();
      } catch (e) {
        console.error("Error disconnecting Stream Chat client: ", e);
      }
      this.client = null;
      this.activeChannel = null;
    }
  }
};
