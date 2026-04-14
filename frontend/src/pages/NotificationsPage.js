import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, ShoppingCart, ChatCircle, FileText, Star } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { notificationsAPI } from '../lib/api';
import { formatDate } from '../lib/utils';
import { toast } from 'sonner';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { navigate('/login'); return; }
    notificationsAPI.getAll()
      .then((res) => setNotifications(res.data || []))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [isAuthenticated, authLoading, navigate, t]);

  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      window.dispatchEvent(new Event('notifications-read'));
    } catch { toast.error(t('common.error')); }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success(t('notifications.markAll.ok'));
      window.dispatchEvent(new Event('notifications-read'));
    } catch { toast.error(t('common.error')); }
  };

  const getIcon = (type) => {
    const map = { order: ShoppingCart, message: ChatCircle, rfq: FileText, review: Star };
    const Icon = map[type] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  const getIconColor = (type) => ({ order: 'bg-green-100 text-green-600', message: 'bg-blue-100 text-blue-600', rfq: 'bg-purple-100 text-purple-600', review: 'bg-yellow-100 text-yellow-600' }[type] || 'bg-slate-100 text-slate-600');

  const handleClick = (n) => {
    markAsRead(n.id);
    const routes = { order: `/orders/${n.related_id}`, message: '/messages', rfq: `/rfq/${n.related_id}`, review: `/products/${n.related_id}` };
    if (n.related_id && routes[n.type]) navigate(routes[n.type]);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <Layout><div className="p-12 text-center">{t('common.loading')}</div></Layout>;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Bell className="w-8 h-8" />
            <h1 className="text-3xl font-bold">{t('notifications.title')}</h1>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('notifications.markAll')}
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <Card className="p-16 text-center">
            <Bell className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-lg text-slate-500">{t('notifications.none')}</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <Card key={n.id}
                className={`cursor-pointer transition-all hover:shadow-md ${!n.is_read ? 'border-accent bg-accent/5' : ''}`}
                onClick={() => handleClick(n)}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor(n.type)}`}>
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-base">{n.title}</h3>
                        {!n.is_read && <div className="w-2 h-2 bg-accent rounded-full mt-1.5" />}
                      </div>
                      <p className="text-slate-600 mt-1 text-[15px]">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-3">{formatDate(n.created_at)}</p>
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