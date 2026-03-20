import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell,
  CheckCircle,
  ShoppingCart,
  ChatCircle,
  FileText,
  Star
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { formatDate } from '../lib/utils';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchNotifications();
  }, [isAuthenticated, navigate]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="w-5 h-5" />;
      case 'message':
        return <ChatCircle className="w-5 h-5" />;
      case 'rfq':
        return <FileText className="w-5 h-5" />;
      case 'review':
        return <Star className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'order':
        return 'bg-green-100 text-green-600';
      case 'message':
        return 'bg-blue-100 text-blue-600';
      case 'rfq':
        return 'bg-purple-100 text-purple-600';
      case 'review':
        return 'bg-yellow-100 text-yellow-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    
    if (notification.related_id) {
      switch (notification.type) {
        case 'order':
          navigate(`/orders/${notification.related_id}`);
          break;
        case 'message':
          navigate(`/messages/${notification.related_id}`);
          break;
        case 'rfq':
          navigate(`/rfq/${notification.related_id}`);
          break;
        case 'review':
          navigate(`/products/${notification.related_id}`);
          break;
        default:
          break;
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="section-heading">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-slate-500 mt-1">{unreadCount} non lue(s)</p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={markAllAsRead}
              data-testid="mark-all-read"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 flex items-start gap-4 text-left hover:bg-slate-50 transition-colors ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(notification.type)}`}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{notification.title}</p>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-accent rounded-full" />
                      )}
                    </div>
                    <p className="text-slate-600 mt-1">{notification.message}</p>
                    <p className="text-sm text-slate-400 mt-2">{formatDate(notification.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default NotificationsPage;
