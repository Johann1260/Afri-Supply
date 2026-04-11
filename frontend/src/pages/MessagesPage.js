import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PaperPlaneTilt, User, ArrowLeft, WifiHigh, WifiSlash } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { messagesAPI } from '../lib/api';
import { toast } from 'sonner';

// P4-21: dériver l'URL WebSocket depuis REACT_APP_BACKEND_URL
const WS_BASE = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000')
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws');

const MAX_RECONNECT = 5;

const MessagesPage = () => {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [partnerLoading, setPartnerLoading] = useState(false);

  // P4-21: WebSocket
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectCount = useRef(0);
  // Garder une ref sur partnerId pour l'utiliser dans les callbacks WS sans stale closure
  const partnerIdRef = useRef(partnerId);
  useEffect(() => { partnerIdRef.current = partnerId; }, [partnerId]);

  const messagesEndRef = useRef(null);

  // ── WebSocket connection ──────────────────────────────────────────
  const connectWS = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !isAuthenticated) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/chat/${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        reconnectCount.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // "sent" = accusé de réception de notre propre message (déjà ajouté de façon optimiste)
          if (data.type === 'sent') return;

          // Message entrant : l'ajouter si c'est la conversation active
          const isActive =
            data.sender_id === partnerIdRef.current ||
            (data.receiver_id === user?.id && data.sender_id === partnerIdRef.current);

          if (isActive) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data];
            });
          }
          // Toujours mettre à jour la liste des conversations (badge non-lu, last_message)
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.partner_id === data.sender_id);
            if (idx === -1) return prev; // nouvelle conv — sera chargée au prochain fetchConversations
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              last_message: data.content,
              last_message_time: data.created_at,
              unread_count: isActive ? 0 : (updated[idx].unread_count || 0) + 1,
            };
            return updated;
          });
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = (event) => {
        setWsConnected(false);
        wsRef.current = null;
        // Reconnexion exponentielle (pas si fermeture volontaire code 1000)
        if (event.code !== 1000 && reconnectCount.current < MAX_RECONNECT) {
          const delay = Math.min(1000 * 2 ** reconnectCount.current, 30000);
          reconnectCount.current += 1;
          reconnectTimer.current = setTimeout(connectWS, delay);
        }
      };

      ws.onerror = () => { /* onclose handle reconnect */ };
    } catch (e) {
      console.error('WS init error:', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) connectWS();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, 'unmount');
    };
  }, [authLoading, isAuthenticated, connectWS]);

  // ── Auth guard ────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchConversations();
  }, [isAuthenticated, authLoading, navigate]);

  // ── Partner resolution ────────────────────────────────────────────
  useEffect(() => {
    if (!partnerId) return;
    fetchMessages(partnerId);
    const found = conversations.find((c) => c.partner_id === partnerId);
    if (found) setSelectedPartner(found);
  }, [partnerId, conversations]);

  useEffect(() => {
    if (!partnerId || selectedPartner) return;
    const found = conversations.find((c) => c.partner_id === partnerId);
    if (found) {
      setSelectedPartner(found);
    } else if (conversations.length > 0 && !partnerLoading) {
      fetchPartnerInfo(partnerId);
    }
  }, [conversations]);

  const fetchPartnerInfo = async (pid) => {
    setPartnerLoading(true);
    try {
      const res = await messagesAPI.getMessages(pid);
      if (res.data?.length > 0) {
        const msg = res.data[0];
        const isSender = msg.sender_id === user?.id;
        setSelectedPartner({
          partner_id: pid,
          partner_name: isSender ? msg.receiver_name : msg.sender_name,
          partner_company: null,
          last_message: msg.content,
          unread_count: 0,
        });
        setMessages(res.data);
      }
    } catch (err) {
      console.error('fetchPartnerInfo error:', err);
    } finally {
      setPartnerLoading(false);
    }
  };

  // ── Auto-scroll ───────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── API helpers ───────────────────────────────────────────────────
  const fetchConversations = async () => {
    try {
      const res = await messagesAPI.getConversations();
      setConversations(res.data || []);
    } catch (err) {
      console.error('fetchConversations error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (pid) => {
    try {
      const res = await messagesAPI.getMessages(pid);
      setMessages(res.data || []);
    } catch (err) {
      console.error('fetchMessages error:', err);
    }
  };

  // ── Send ──────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !partnerId) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // P4-21: envoi WebSocket + ajout optimiste
      wsRef.current.send(JSON.stringify({ type: 'message', receiver_id: partnerId, content }));
      setMessages((prev) => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          sender_id: user?.id,
          receiver_id: partnerId,
          content,
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);
      setSending(false);
    } else {
      // Fallback REST si WS indisponible
      try {
        await messagesAPI.send({ receiver_id: partnerId, content });
        await fetchMessages(partnerId);
        await fetchConversations();
      } catch (err) {
        toast.error("Erreur lors de l'envoi");
        setNewMessage(content);
      } finally {
        setSending(false);
      }
    }
  };

  const selectConversation = (partner) => {
    setSelectedPartner(partner);
    navigate(`/messages/${partner.partner_id}`);
  };

  const partnerDisplayName =
    selectedPartner?.partner_name ?? (partnerLoading ? 'Chargement…' : 'Conversation');

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header avec indicateur WS */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="section-heading">Messages</h1>
          <div className="flex items-center gap-1.5 text-xs">
            {wsConnected ? (
              <>
                <WifiHigh className="w-4 h-4 text-green-500" weight="fill" />
                <span className="text-green-600 font-medium">Temps réel</span>
              </>
            ) : (
              <>
                <WifiSlash className="w-4 h-4 text-slate-400" />
                <span className="text-slate-400">Mode standard</span>
              </>
            )}
          </div>
        </div>

        <div
          className="bg-white border border-slate-200 rounded-lg overflow-hidden flex"
          style={{ height: '70vh' }}
        >
          {/* Conversations list */}
          <div className={`w-full md:w-80 border-r border-slate-200 flex flex-col ${partnerId ? 'hidden md:flex' : ''}`}>
            <div className="p-4 border-b border-slate-200">
              <h2 className="font-semibold">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-slate-500">Aucune conversation</div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.partner_id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                      partnerId === conv.partner_id ? 'bg-primary/5' : ''
                    }`}
                    data-testid={`conversation-${conv.partner_id}`}
                  >
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{conv.partner_name}</p>
                        {conv.unread_count > 0 && (
                          <span className="w-5 h-5 bg-accent text-white text-xs rounded-full flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">{conv.last_message}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Messages area */}
          <div className={`flex-1 flex flex-col ${!partnerId ? 'hidden md:flex' : ''}`}>
            {partnerId ? (
              <>
                <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                  <button onClick={() => navigate('/messages')} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{partnerDisplayName}</p>
                    {selectedPartner?.partner_company && (
                      <p className="text-sm text-slate-500">{selectedPartner.partner_company}</p>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg p-3 ${
                        msg.sender_id === user?.id ? 'bg-primary text-white' : 'bg-white border border-slate-200'
                      }`}>
                        <p className="break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-white/70' : 'text-slate-400'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre message..."
                    className="flex-1"
                    data-testid="message-input"
                  />
                  <Button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-accent hover:bg-accent-hover"
                    data-testid="send-message"
                  >
                    <PaperPlaneTilt className="w-5 h-5" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <User className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Sélectionnez une conversation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MessagesPage;