import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  PaperPlaneTilt, 
  User,
  ArrowLeft
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../context/AuthContext';
import { messagesAPI } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

const MessagesPage = () => {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchConversations();
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (partnerId) {
      fetchMessages(partnerId);
      const partner = conversations.find(c => c.partner_id === partnerId);
      setSelectedPartner(partner);
    }
  }, [partnerId, conversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await messagesAPI.getConversations();
      setConversations(res.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (pid) => {
    try {
      const res = await messagesAPI.getMessages(pid);
      setMessages(res.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !partnerId) return;

    setSending(true);
    try {
      await messagesAPI.send({
        receiver_id: partnerId,
        content: newMessage.trim()
      });
      setNewMessage('');
      await fetchMessages(partnerId);
      await fetchConversations();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const selectConversation = (partner) => {
    setSelectedPartner(partner);
    navigate(`/messages/${partner.partner_id}`);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="section-heading mb-6">Messages</h1>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex" style={{ height: '70vh' }}>
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
                <div className="p-4 text-center text-slate-500">
                  Aucune conversation
                </div>
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
                {/* Header */}
                <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                  <button 
                    onClick={() => navigate('/messages')}
                    className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{selectedPartner?.partner_name || 'Chargement...'}</p>
                    {selectedPartner?.partner_company && (
                      <p className="text-sm text-slate-500">{selectedPartner.partner_company}</p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.sender_id === user?.id
                            ? 'bg-primary text-white'
                            : 'bg-white border border-slate-200'
                        }`}
                      >
                        <p className="break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.sender_id === user?.id ? 'text-white/70' : 'text-slate-400'
                        }`}>
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
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
