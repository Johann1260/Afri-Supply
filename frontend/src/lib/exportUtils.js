// src/lib/exportUtils.js
// P4-23: Utilitaires d'export CSV et JSON pour commandes et catalogue

/**
 * Convertit un tableau d'objets en CSV et déclenche le téléchargement
 * @param {Object[]} rows - données
 * @param {string[]} columns - colonnes à inclure (clés des objets)
 * @param {Object} headers - mapping clé → libellé colonne
 * @param {string} filename - nom du fichier sans extension
 */
export const exportCSV = (rows, columns, headers, filename) => {
  if (!rows || rows.length === 0) return;

  const headerRow = columns.map((col) => headers[col] ?? col).join(';');
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col] ?? '';
        // Échapper les guillemets et entourer si nécessaire
        const str = String(val).replace(/"/g, '""');
        return str.includes(';') || str.includes('\n') || str.includes('"')
          ? `"${str}"`
          : str;
      })
      .join(';')
  );

  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n'); // BOM pour Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── Presets ───────────────────────────────────────────────────────────────────

/**
 * Export des commandes acheteur
 */
export const exportBuyerOrders = (orders) => {
  exportCSV(
    orders,
    ['order_number', 'supplier_name', 'total', 'status', 'payment_status', 'created_at'],
    {
      order_number:   'N° commande',
      supplier_name:  'Fournisseur',
      total:          'Total (XAF)',
      status:         'Statut livraison',
      payment_status: 'Statut paiement',
      created_at:     'Date',
    },
    'mes_commandes'
  );
};

/**
 * Export des commandes fournisseur
 */
export const exportSupplierOrders = (orders) => {
  exportCSV(
    orders,
    ['order_number', 'buyer_name', 'total', 'status', 'payment_status', 'created_at'],
    {
      order_number:   'N° commande',
      buyer_name:     'Acheteur',
      total:          'Total (XAF)',
      status:         'Statut livraison',
      payment_status: 'Statut paiement',
      created_at:     'Date',
    },
    'commandes_recues'
  );
};

/**
 * Export du catalogue produits fournisseur
 */
export const exportSupplierProducts = (products) => {
  exportCSV(
    products,
    ['name', 'category_name', 'price', 'unit', 'min_order_quantity', 'stock_quantity', 'is_available'],
    {
      name:               'Nom du produit',
      category_name:      'Catégorie',
      price:              'Prix (XAF)',
      unit:               'Unité',
      min_order_quantity: 'Qté min.',
      stock_quantity:     'Stock',
      is_available:       'Disponible',
    },
    'catalogue_produits'
  );
};