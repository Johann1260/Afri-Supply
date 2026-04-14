import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Buildings, Phone, MapPin, Lock, SignOut, FloppyDisk } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import api from '../lib/api';
import { toast } from 'sonner';

const CEMAC_COUNTRIES = [
  'Cameroun', 'Gabon', 'Congo', 'Tchad', 'Guinée Équatoriale', 'Centrafrique',
];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useLocale();

  const [saving, setSaving] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    company_name: user?.company_name || '',
    phone: user?.phone || '',
    city: user?.city || '',
    country: user?.country || '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/auth/me', formData);
      const updated = { ...user, ...res.data };
      localStorage.setItem('user', JSON.stringify(updated));
      toast.success(t('profile.saved'));
    } catch (err) {
      const msg = err.response?.data?.detail || t('common.error');
      toast.error(typeof msg === 'string' ? msg : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordData.current_password || !passwordData.new_password) {
      toast.error('Tous les champs sont obligatoires');
      return;
    }
    if (passwordData.new_password.length < 6) {
      toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error(t('profile.pwd.mismatch'));
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put('/auth/password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });
      toast.success('Mot de passe modifié avec succès');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      const msg = err.response?.data?.detail || `${t('profile.current.pwd')} incorrect`;
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-bold text-2xl text-slate-900">{t('profile.title')}</h1>
            <p className="text-slate-500 mt-1">{user?.email}</p>
          </div>
          <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full capitalize">
            {user?.user_type === 'buyer' ? t('profile.type.buyer') : t('profile.type.supplier')}
          </span>
        </div>

        <div className="space-y-6">
          {/* Informations générales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-5 h-5 text-primary" />
                Informations personnelles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Nom complet *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name">{t('profile.company')}</Label>
                    <div className="relative">
                      <Buildings className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        className="pl-9"
                        placeholder="Nom de votre entreprise"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">{t('profile.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="pl-9"
                      placeholder="+237 6XX XXX XXX"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">{t('profile.city')}</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="pl-9"
                        placeholder="Douala"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="country">{t('profile.country')}</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(val) => setFormData({ ...formData, country: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {CEMAC_COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="bg-accent hover:bg-accent-hover"
                    disabled={saving}
                  >
                    <FloppyDisk className="w-4 h-4 mr-2" />
                    {saving ? t('profile.saving') : t('profile.save')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Changement de mot de passe */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="w-5 h-5 text-primary" />
                Changer le mot de passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <Label htmlFor="current_password">{t('profile.current.pwd')} *</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordData.current_password}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, current_password: e.target.value })
                    }
                    placeholder="••••••••"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new_password">{t('profile.new.pwd')} *</Label>
                    <Input
                      id="new_password"
                      type="password"
                      value={passwordData.new_password}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, new_password: e.target.value })
                      }
                      placeholder="••••••••"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm_password">{t('profile.confirm.pwd')} *</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      value={passwordData.confirm_password}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirm_password: e.target.value })
                      }
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                {passwordData.new_password &&
                  passwordData.confirm_password &&
                  passwordData.new_password !== passwordData.confirm_password && (
                    <p className="text-sm text-red-500">{t('profile.pwd.mismatch')}</p>
                  )}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={
                      passwordSaving ||
                      (passwordData.new_password !== passwordData.confirm_password &&
                        !!passwordData.confirm_password)
                    }
                  >
                    {passwordSaving ? 'Modification...' : 'Modifier le mot de passe'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Zone danger */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-base text-red-700">{t('profile.danger')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Se déconnecter</p>
                  <p className="text-sm text-slate-500">Vous serez redirigé vers la page d'accueil.</p>
                </div>
                <Button
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={() => setShowLogoutDialog(true)}
                >
                  <SignOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation déconnexion */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.logout.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              Vous devrez vous reconnecter pour accéder à votre compte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              Déconnexion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
};

export default ProfilePage;