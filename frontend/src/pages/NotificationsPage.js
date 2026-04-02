import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, CheckCircle, ShoppingCart, ChatCircle, FileText, Star 
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error("Impossible de charger les notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchNotifications();
  }, [isAuthenticated, authLoading, navigate]);

  const markAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success("Toutes les notifications ont été marquées comme lues");
    } catch (error) {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'order': return <ShoppingCart className="w-5 h-5" />;
      case 'message': return <ChatCircle className="w-5 h-5" />;
      case 'rfq': return <FileText className="w-5 h-5" />;
      case 'review': return <Star className="w-5 h-5" />;
      default: return <Bell className="w-5 h-5" />;
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case 'order': return 'bg-green-100 text-green-600';
      case 'message': return 'bg-blue-100 text-blue-600';
      case 'rfq': return 'bg-purple-100 text-purple-600';
      case 'review': return 'bg-yellow-100 text-yellow-600';
      default: return 'bg-slate-100 text-slate-600';
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
          navigate(`/messages`); // ou vers la conversation si tu as l'ID
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

  if (loading) {
    return (
      <Layout>
        <div className="p-12 text-center">Chargement des notifications...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Notifications</h1>
          </div>

          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="p-16 text-center">
            <Bell className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg text-slate-500">Aucune notification pour le moment</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <Card 
                key={notification.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  !notification.is_read ? 'border-accent bg-accent/5' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(notification.type)}`}>
                      {getIcon(notification.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-base">{notification.title}</h3>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-accent rounded-full mt-1.5" />
                        )}
                      </div>
                      <p className="text-slate-600 mt-1 text-[15px]">{notification.message}</p>
                      <p className="text-xs text-slate-400 mt-3">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;