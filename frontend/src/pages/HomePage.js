import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Buildings, 
  Wrench, 
  HardHat,
  Gear,
  TrendUp,
  Users,
  ShieldCheck,
  Truck
} from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { ProductGrid } from '../components/products';
import { Button } from '../components/ui/button';
import { categoriesAPI, productsAPI, seedAPI } from '../lib/api';

const HomePage = () => {
  const [categories, setCategories] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Seed data first if needed
        try {
          await seedAPI.seed();
        } catch (e) {
          // Already seeded, ignore
        }

        const [catRes, prodRes] = await Promise.all([
          categoriesAPI.getAll(),
          productsAPI.getPopular(8)
        ]);
        setCategories(catRes.data);
        setPopularProducts(prodRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCategoryIcon = (iconName) => {
    const icons = {
      Wrench: Wrench,
      HardHat: HardHat,
      Gear: Gear,
    };
    const Icon = icons[iconName] || Buildings;
    return <Icon className="w-8 h-8" weight="duotone" />;
  };

  const stats = [
    { label: 'Fournisseurs actifs', value: '500+', icon: Users },
    { label: 'Produits disponibles', value: '10K+', icon: Buildings },
    { label: 'Transactions réussies', value: '25K+', icon: TrendUp },
    { label: 'Pays couverts', value: '6', icon: Truck },
  ];

  const benefits = [
    {
      icon: ShieldCheck,
      title: 'Fournisseurs vérifiés',
      description: 'Tous nos fournisseurs sont certifiés et audités pour garantir la qualité.'
    },
    {
      icon: Truck,
      title: 'Livraison CEMAC',
      description: 'Livraison dans les 6 pays de la zone CEMAC avec suivi en temps réel.'
    },
    {
      icon: Users,
      title: 'Support dédié',
      description: 'Une équipe d\'experts disponible pour accompagner vos achats B2B.'
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <img 
            src="https://images.pexels.com/photos/236698/pexels-photo-236698.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block px-4 py-1 bg-accent/20 text-accent rounded-full text-sm font-bold mb-6">
                Zone CEMAC
              </span>
              <h1 className="font-heading font-black text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
                La marketplace B2B industrielle pour
                <span className="text-accent"> l'Afrique centrale</span>
              </h1>
              <p className="text-lg text-white/80 mb-8 max-w-xl">
                Connectez-vous avec les meilleurs fournisseurs industriels du Cameroun, Gabon, 
                Congo, Tchad, Guinée Équatoriale et Centrafrique.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/products">
                  <Button size="lg" className="bg-accent hover:bg-accent-hover w-full sm:w-auto" data-testid="hero-cta-products">
                    Explorer les produits
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto" data-testid="hero-cta-register">
                    Devenir fournisseur
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="grid grid-cols-2 gap-4"
            >
              {stats.map((stat, i) => (
                <div 
                  key={i}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6"
                >
                  <stat.icon className="w-8 h-8 text-accent mb-3" weight="duotone" />
                  <p className="font-heading font-bold text-3xl text-white">{stat.value}</p>
                  <p className="text-sm text-white/70">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <p className="overline text-accent mb-2">CATÉGORIES</p>
              <h2 className="section-heading">Nos secteurs industriels</h2>
            </div>
            <Link to="/categories" className="hidden sm:flex items-center gap-2 text-primary font-medium hover:text-accent transition-colors">
              Voir tout
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {categories.map((category, i) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
              >
                <Link 
                  to={`/products?category_id=${category.id}`}
                  className="group block relative h-64 rounded-lg overflow-hidden"
                  data-testid={`category-card-${category.id}`}
                >
                  <img 
                    src={category.image_url || 'https://images.pexels.com/photos/236698/pexels-photo-236698.jpeg'}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center gap-3 mb-2 text-accent">
                      {getCategoryIcon(category.icon)}
                    </div>
                    <h3 className="font-heading font-bold text-xl text-white mb-1">
                      {category.name}
                    </h3>
                    <p className="text-sm text-white/70 line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Products Section */}
      <section className="py-16 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <p className="overline text-accent mb-2">PRODUITS POPULAIRES</p>
              <h2 className="section-heading">Les plus demandés</h2>
            </div>
            <Link to="/products" className="hidden sm:flex items-center gap-2 text-primary font-medium hover:text-accent transition-colors">
              Voir tout
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <ProductGrid products={popularProducts} loading={loading} />
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="overline text-accent mb-2">POURQUOI NOUS CHOISIR</p>
            <h2 className="section-heading">Votre partenaire industriel de confiance</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {benefits.map((benefit, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <benefit.icon className="w-8 h-8 text-primary" weight="duotone" />
                </div>
                <h3 className="font-heading font-bold text-xl text-slate-900 mb-3">
                  {benefit.title}
                </h3>
                <p className="text-slate-600">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 lg:py-24 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-heading font-bold text-3xl lg:text-4xl text-white mb-6">
            Prêt à développer votre activité en Afrique centrale ?
          </h2>
          <p className="text-lg text-white/80 mb-8">
            Rejoignez des centaines de fournisseurs et acheteurs industriels sur AfriSupply.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register?type=supplier">
              <Button size="lg" className="bg-accent hover:bg-accent-hover w-full sm:w-auto" data-testid="cta-become-supplier">
                Devenir fournisseur
              </Button>
            </Link>
            <Link to="/register?type=buyer">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 w-full sm:w-auto" data-testid="cta-become-buyer">
                Créer un compte acheteur
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default HomePage;
