import React, { useState, useEffect } from 'react';
import { useLocale } from '../context/LocaleContext';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock, Eye } from '@phosphor-icons/react';
import { Layout } from '../components/layout';
import { blogAPI } from '../lib/api';
import { formatDate } from '../lib/utils';

const BlogPage = () => {
  const { t } = useLocale();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await blogAPI.getAll({ limit: 20 });
        setPosts(res.data || []);
      } catch (err) {
        console.error('Failed to fetch blog posts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const [featured, ...rest] = posts;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-10">
          <p className="overline text-accent mb-2">{t('blog.overline')}</p>
          <h1 className="section-heading">{t('blog.title')}</h1>
          <p className="text-slate-500 mt-2 max-w-xl">
            {t('blog.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse space-y-3">
                <div className="aspect-video bg-slate-200 rounded-xl" />
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 text-lg">{t('blog.none')}</p>
          </div>
        ) : (
          <>
            {/* Article à la une */}
            {featured && (
              <Link
                to={`/blog/${featured.id}`}
                className="group grid md:grid-cols-2 gap-8 bg-white border border-slate-200 rounded-2xl overflow-hidden mb-12 hover:shadow-lg transition-shadow"
              >
                <div className="aspect-video md:aspect-auto bg-slate-100 overflow-hidden">
                  {featured.image_url ? (
                    <img
                      src={featured.image_url}
                      alt={featured.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="p-8 flex flex-col justify-center">
                  {featured.category && (
                    <span className="inline-block px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full mb-4 w-fit">
                      {featured.category}
                    </span>
                  )}
                  <h2 className="font-heading font-bold text-2xl text-slate-900 mb-3 group-hover:text-accent transition-colors line-clamp-3">
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p className="text-slate-500 line-clamp-3 mb-6">{featured.excerpt}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDate(featured.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {featured.views || 0} {t('blog.views')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-accent font-medium mt-6">
                    {t('blog.read')}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            )}

            {/* Grille des autres articles */}
            {rest.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {rest.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/${post.id}`}
                    className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-video bg-slate-100 overflow-hidden">
                      {post.image_url ? (
                        <img
                          src={post.image_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      {post.category && (
                        <span className="text-xs font-bold text-accent uppercase tracking-widest">
                          {post.category}
                        </span>
                      )}
                      <h3 className="font-heading font-semibold text-slate-900 mt-2 mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                        {post.title}
                      </h3>
                      {post.excerpt && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-4">{post.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(post.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {post.views || 0}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default BlogPage;